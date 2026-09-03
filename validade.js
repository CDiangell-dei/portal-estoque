        let currentSector = 'COMERCIO';
        let rawValidadeDataset = [];
        let filteredValidadeDataset = [];
        let rawSb1Dataset = [];
        let rawKnownWarehouses = [];
        let stagedImportRows = [];

        let rawSaldoDataset = [];
        let globalSd2PricesMap = {};

        // Mapeamento de Códigos de Fornecedores e Códigos de Barras / QR Code
        let rawFornecedoresProdutos = [];
        let fornecedorByNossoMap = {};   // codigo_nosso -> { id, codigo_nosso, codigo_fornecedor, codigo_antigo, codigo_barras }
        let nossoByFornecedorMap = {};   // uppercase(codigo_fornecedor) -> codigo_nosso
        let nossoByBarrasMap = {};       // uppercase(codigo_barras) -> codigo_nosso
        let nossoByAntigoMap = {};       // uppercase(codigo_antigo) -> codigo_nosso

        function getTargetFilialForSector() {
            if (!currentUser) return '01';
            if (isGlobalFilial(currentUser)) {
                const sel = document.getElementById('valFilterFilial');
                if (sel && sel.value && sel.value !== '00') {
                    return sel.value;
                }
                return 'ALL';
            }
            if (currentSector === 'COMERCIO') {
                return String(currentUser.filial_comercio || currentUser.filial_atual || '01').trim().padStart(2, '0');
            } else {
                return String(currentUser.filial_industria || currentUser.filial_atual || '06').trim().padStart(2, '0');
            }
        }

        async function switchSector(sector) {
            currentSector = sector;
            const btnC = document.getElementById('btnSectorComercio');
            const btnI = document.getElementById('btnSectorIndustria');

            if (sector === 'COMERCIO') {
                if (btnC) btnC.className = "px-4 py-2 rounded-xl text-xs font-black transition-all bg-[#002f6c] text-white shadow-sm flex items-center gap-1.5 touch-active";
                if (btnI) btnI.className = "px-4 py-2 rounded-xl text-xs font-black transition-all text-slate-600 hover:text-slate-900 flex items-center gap-1.5 touch-active";
            } else {
                if (btnC) btnC.className = "px-4 py-2 rounded-xl text-xs font-black transition-all text-slate-600 hover:text-slate-900 flex items-center gap-1.5 touch-active";
                if (btnI) btnI.className = "px-4 py-2 rounded-xl text-xs font-black transition-all bg-[#002f6c] text-white shadow-sm flex items-center gap-1.5 touch-active";
            }
            await loadValidadeData();
            initValidadeRealtime();
        }

        let validadeRealtimeChannel = null;
        function initValidadeRealtime() {
            if (!supabaseClient) return;
            if (validadeRealtimeChannel) {
                try { supabaseClient.removeChannel(validadeRealtimeChannel); } catch(e) {}
            }
            
            const valTable = currentSector === 'INDUSTRIA' ? 'validade_industria' : 'validade_comercio';
            const saldoTable = currentSector === 'INDUSTRIA' ? 'saldo_industria' : 'saldo_comercio';

            validadeRealtimeChannel = supabaseClient
                .channel(`validade_realtime_${currentSector}_${Date.now()}`)
                .on('postgres_changes', { event: '*', schema: 'public', table: valTable }, (payload) => {
                    console.log("[Realtime Validade] Atualização recebida:", payload);
                    loadValidadeData(true);
                })
                .on('postgres_changes', { event: '*', schema: 'public', table: saldoTable }, (payload) => {
                    console.log("[Realtime Validade] Saldo atualizado:", payload);
                    loadValidadeData(true);
                })
                .subscribe();
        }

        async function loadValidadeData(silent = false) {
            if (!supabaseClient) return;
            const loader = document.getElementById('globalLoader');
            if (!silent && loader) loader.classList.remove('hidden');

            const valTable = currentSector === 'INDUSTRIA' ? 'validade_industria' : 'validade_comercio';
            const sb1Table = currentSector === 'INDUSTRIA' ? 'sb1_industria' : 'sb1_comercio';
            const saldoTable = currentSector === 'INDUSTRIA' ? 'saldo_industria' : 'saldo_comercio';

            try {
                const targetFilial = getTargetFilialForSector();

                // 1. Carrega Validades
                let query = supabaseClient.from(valTable).select('*');
                if (!isGlobalFilial(currentUser) && targetFilial && targetFilial !== 'ALL' && targetFilial !== '00') {
                    query = query.eq('filial', targetFilial);
                }
                const { data, error } = await query.order('data_validade', { ascending: true });

                if (error) {
                    console.error("Erro ao carregar validades:", error);
                    showAlert("Erro ao carregar dados de validade.", "warning");
                    rawValidadeDataset = [];
                } else {
                    rawValidadeDataset = (data || []).map(v => ({
                        ...v,
                        filial: String(v.filial || '01').trim().padStart(2, '0'),
                        armazem: String(v.armazem || '01').trim().padStart(2, '0'),
                        produto: String(v.produto || '').trim().toUpperCase(),
                        lote: String(v.lote || '').trim(),
                        embalagem: String(v.embalagem || '').trim(),
                        quantidade: parseFloat(v.quantidade || 0)
                    }));
                }

                // 2. Carrega Saldos do ERP para Comparação Lotes x Saldo Sistema
                let saldoAll = [];
                let fromSaldo = 0, stepSaldo = 1000, fetchMoreSaldo = true;
                while (fetchMoreSaldo) {
                    let sQuery = supabaseClient.from(saldoTable).select('produto, filial, armazem, quantidade, custo_unitario');
                    if (!isGlobalFilial(currentUser) && targetFilial && targetFilial !== 'ALL' && targetFilial !== '00') {
                        sQuery = sQuery.eq('filial', targetFilial);
                    }
                    const { data: directData, error: dErr } = await sQuery.range(fromSaldo, fromSaldo + stepSaldo - 1);
                    if (dErr || !directData || directData.length === 0) {
                        fetchMoreSaldo = false;
                    } else {
                        saldoAll = saldoAll.concat(directData);
                        if (directData.length < stepSaldo) fetchMoreSaldo = false; else fromSaldo += stepSaldo;
                    }
                }

                rawSaldoDataset = (saldoAll || []).map(s => ({
                    produto: String(s.produto || '').trim().toUpperCase(),
                    filial: String(s.filial || '01').trim().padStart(2, '0'),
                    armazem: String(s.armazem || '01').trim().padStart(2, '0'),
                    quantidade: parseFloat(s.quantidade || 0),
                    custo_unitario: parseFloat(s.custo_unitario || 0)
                }));

                // 3. Carrega Fornecedores Produtos (De-Para Fornecedores e Códigos de Barras)
                try {
                    const { data: fornData } = await supabaseClient.from('fornecedores_produtos').select('*');
                    if (fornData) {
                        rawFornecedoresProdutos = fornData;
                    }
                } catch(errForn) {
                    console.warn("Aviso ao carregar fornecedores_produtos:", errForn);
                }

                // 4. Carrega Catálogo SB1 apenas dos produtos ativos (velocidade ultra-rápida)
                let sb1Data = [];
                const activeCodesSet = new Set([
                    ...rawValidadeDataset.map(v => v.produto),
                    ...rawSaldoDataset.map(s => s.produto)
                ]);
                const activeCodes = Array.from(activeCodesSet).filter(Boolean);

                if (activeCodes.length > 0) {
                    const chunkSize = 500;
                    for (let i = 0; i < activeCodes.length; i += chunkSize) {
                        const chunk = activeCodes.slice(i, i + chunkSize);
                        const { data: chunkData } = await supabaseClient.from(sb1Table)
                            .select('codigo, descricao, unidade, endereco, codigo_barras')
                            .in('codigo', chunk);
                        if (chunkData) sb1Data = sb1Data.concat(chunkData);
                    }
                }

                rawSb1Dataset = sb1Data.map(p => ({
                    Codigo: String(p.codigo || '').trim(),
                    codigo: String(p.codigo || '').trim(),
                    'Descr.Espec.': p.descricao || '-',
                    descricao: p.descricao || '-',
                    Unidade: p.unidade || 'UN',
                    unidade: p.unidade || 'UN',
                    endereco: p.endereco || '',
                    Endereco: p.endereco || '',
                    codigo_barras: String(p.codigo_barras || '').trim()
                }));

                // Reconstrói índices em memória para busca instantânea por Fornecedor / Barras / Interno
                rebuildFornecedoresMaps();

                // 4. Carrega Preços da SD2 e Custo de Compra para Valoração Financeira
                let sd2PricesMap = {};
                
                // Prioriza Custo Unitário do Saldo
                rawSaldoDataset.forEach(s => {
                    if (s.custo_unitario && s.custo_unitario > 0 && !sd2PricesMap[s.produto]) {
                        sd2PricesMap[s.produto] = s.custo_unitario;
                    }
                });

                try {
                    const sd2Table = currentSector === 'INDUSTRIA' ? 'sd2_industria' : 'sd2_comercio';
                    const { data: pData } = await supabaseClient.from(sd2Table)
                        .select('produto, vlr_unitario')
                        .gt('vlr_unitario', 2.5)
                        .limit(2000);
                    const accum = {};
                    (pData || []).forEach(p => {
                        const cod = String(p.produto || '').trim();
                        const v = Number(p.vlr_unitario || 0);
                        if (!accum[cod]) accum[cod] = { sum: 0, count: 0 };
                        accum[cod].sum += v;
                        accum[cod].count++;
                    });
                    Object.keys(accum).forEach(cod => {
                        if (!sd2PricesMap[cod]) {
                            sd2PricesMap[cod] = accum[cod].sum / accum[cod].count;
                        }
                    });
                } catch(eP) {
                    console.warn("Aviso preços SD2:", eP);
                }
                globalSd2PricesMap = sd2PricesMap;

                const saldoArmazens = [...new Set(rawSaldoDataset.map(s => s.armazem))].filter(Boolean);
                const valArmazens = (rawValidadeDataset || [])
                    .map(v => String(v.armazem || '').trim().padStart(2, '0'))
                    .filter(Boolean);

                rawKnownWarehouses = [...new Set([...saldoArmazens, ...valArmazens])]
                    .sort((a,b) => a.localeCompare(b, undefined, { numeric: true }));

            } catch (err) {
                console.error("Erro ao carregar dados:", err);
                rawValidadeDataset = [];
                rawSaldoDataset = [];
            } finally {
                if (!silent && loader) loader.classList.add('hidden');
            }

            populateValidadeFiltersDropdowns();
            populateProductsDatalist();
            applyValidadeFilters();
            if (currentProductLotsData) {
                renderProductLotsModal();
            }
        }

        /**
         * Reconstrói mapas de busca rápida em memória por fornecedor, código de barras e código antigo
         */
        function rebuildFornecedoresMaps() {
            fornecedorByNossoMap = {};
            nossoByFornecedorMap = {};
            nossoByBarrasMap = {};
            nossoByAntigoMap = {};

            (rawFornecedoresProdutos || []).forEach(f => {
                const codNosso = String(f.codigo_nosso || '').trim().toUpperCase();
                if (!codNosso) return;

                fornecedorByNossoMap[codNosso] = f;

                const codForn = String(f.codigo_fornecedor || '').trim().toUpperCase();
                if (codForn) {
                    nossoByFornecedorMap[codForn] = codNosso;
                }

                const codBar = String(f.codigo_barras || '').trim().toUpperCase();
                if (codBar) {
                    nossoByBarrasMap[codBar] = codNosso;
                }

                const codAnt = String(f.codigo_antigo || '').trim().toUpperCase();
                if (codAnt) {
                    nossoByAntigoMap[codAnt] = codNosso;
                }
            });

            // Inclui também códigos de barras registrados no SB1
            (rawSb1Dataset || []).forEach(p => {
                const cod = String(p.Codigo || p.codigo || '').trim().toUpperCase();
                const bar = String(p.codigo_barras || '').trim().toUpperCase();
                if (cod && bar && !nossoByBarrasMap[bar]) {
                    nossoByBarrasMap[bar] = cod;
                }
            });
        }

        function cacheSb1Item(p) {
            if (!p) return null;
            const cod = String(p.codigo || p.Codigo || '').trim().toUpperCase();
            let existing = rawSb1Dataset.find(x => String(x.Codigo || x.codigo).trim().toUpperCase() === cod);
            if (existing) {
                if (p.codigo_barras) existing.codigo_barras = String(p.codigo_barras).trim();
                return existing;
            }
            const newObj = {
                Codigo: cod,
                codigo: cod,
                'Descr.Espec.': p.descricao || '-',
                descricao: p.descricao || '-',
                Unidade: p.unidade || 'UN',
                unidade: p.unidade || 'UN',
                endereco: p.endereco || '',
                Endereco: p.endereco || '',
                codigo_barras: String(p.codigo_barras || '').trim()
            };
            rawSb1Dataset.push(newObj);
            return newObj;
        }

        async function fetchAndCacheSingleSb1(codNosso) {
            const cod = String(codNosso || '').trim().toUpperCase();
            if (!cod) return null;
            let existing = rawSb1Dataset.find(p => String(p.Codigo || p.codigo).trim().toUpperCase() === cod);
            if (existing) return existing;

            const sb1Table = currentSector === 'INDUSTRIA' ? 'sb1_industria' : 'sb1_comercio';
            try {
                let { data: sbMatch } = await supabaseClient.from(sb1Table).select('codigo, descricao, unidade, endereco, codigo_barras').eq('codigo', cod).maybeSingle();
                if (!sbMatch && currentSector === 'COMERCIO') {
                    const { data: indMatch } = await supabaseClient.from('sb1_industria').select('codigo, descricao, unidade, endereco, codigo_barras').eq('codigo', cod).maybeSingle();
                    sbMatch = indMatch;
                }
                if (sbMatch) {
                    return cacheSb1Item(sbMatch);
                }
            } catch(e) {
                console.warn("Erro ao buscar SB1 individual:", e);
            }
            return null;
        }

        /**
         * Busca inteligente de material por:
         * 1) Código interno (SB1)
         * 2) Código do Fornecedor
         * 3) Código de Barras / QR Code
         * 4) Código Antigo
         */
        async function findProductByAnyCode(query) {
            if (!query) return null;
            const clean = String(query).trim().toUpperCase();

            // 1. Match direto por código interno no cache SB1
            let match = rawSb1Dataset.find(p => String(p.Codigo || p.codigo).trim().toUpperCase() === clean);
            if (match) {
                return { product: match, matchType: 'CODIGO_INTERNO', originalInput: clean };
            }

            // 2. Match por Código de Fornecedor no De-Para
            if (nossoByFornecedorMap[clean]) {
                const codNosso = nossoByFornecedorMap[clean];
                let pMatch = await fetchAndCacheSingleSb1(codNosso);
                if (pMatch) {
                    return { product: pMatch, matchType: 'CODIGO_FORNECEDOR', matchedCode: clean, originalInput: clean };
                }
            }

            // 3. Match por Código de Barras no De-Para
            if (nossoByBarrasMap[clean]) {
                const codNosso = nossoByBarrasMap[clean];
                let pMatch = await fetchAndCacheSingleSb1(codNosso);
                if (pMatch) {
                    return { product: pMatch, matchType: 'CODIGO_BARRAS', matchedCode: clean, originalInput: clean };
                }
            }

            // 4. Match por Código Antigo
            if (nossoByAntigoMap[clean]) {
                const codNosso = nossoByAntigoMap[clean];
                let pMatch = await fetchAndCacheSingleSb1(codNosso);
                if (pMatch) {
                    return { product: pMatch, matchType: 'CODIGO_ANTIGO', matchedCode: clean, originalInput: clean };
                }
            }

            // 5. Fallback SB1 direto no Supabase
            const pDirect = await fetchAndCacheSingleSb1(clean);
            if (pDirect) {
                return { product: pDirect, matchType: 'CODIGO_INTERNO', originalInput: clean };
            }

            // 6. Fallback fornecedores_produtos direto no Supabase
            try {
                const { data: fornDirect } = await supabaseClient
                    .from('fornecedores_produtos')
                    .select('*')
                    .or(`codigo_fornecedor.eq.${clean},codigo_barras.eq.${clean},codigo_antigo.eq.${clean}`)
                    .limit(1);

                if (fornDirect && fornDirect.length > 0) {
                    const fRec = fornDirect[0];
                    const codNosso = String(fRec.codigo_nosso).trim().toUpperCase();
                    rawFornecedoresProdutos.push(fRec);
                    rebuildFornecedoresMaps();

                    const pMatch = await fetchAndCacheSingleSb1(codNosso);
                    if (pMatch) {
                        let mType = 'CODIGO_FORNECEDOR';
                        if (String(fRec.codigo_barras).trim().toUpperCase() === clean) mType = 'CODIGO_BARRAS';
                        else if (String(fRec.codigo_antigo).trim().toUpperCase() === clean) mType = 'CODIGO_ANTIGO';
                        return { product: pMatch, matchType: mType, matchedCode: clean, originalInput: clean };
                    }
                }
            } catch(eForn) {
                console.warn("Aviso busca direta fornecedores_produtos:", eForn);
            }

            return null;
        }

        /**
         * Verifica se um código de barras já está vinculado a outro material (Alerta de Repetição)
         */
        function checkDuplicateBarcode(newBarcode, currentProductCode) {
            const clean = String(newBarcode).trim().toUpperCase();
            const curr = String(currentProductCode).trim().toUpperCase();
            if (!clean) return { isDuplicate: false };

            const dupForn = rawFornecedoresProdutos.find(f => 
                String(f.codigo_barras || '').trim().toUpperCase() === clean &&
                String(f.codigo_nosso || '').trim().toUpperCase() !== curr
            );
            if (dupForn) {
                return { isDuplicate: true, otherCode: dupForn.codigo_nosso };
            }

            const dupSb1 = rawSb1Dataset.find(p => 
                String(p.codigo_barras || '').trim().toUpperCase() === clean &&
                String(p.Codigo || p.codigo || '').trim().toUpperCase() !== curr
            );
            if (dupSb1) {
                return { isDuplicate: true, otherCode: dupSb1.Codigo || dupSb1.codigo };
            }

            return { isDuplicate: false };
        }

        /**
         * Verifica se um código de fornecedor já está vinculado a outro material (Alerta de Repetição)
         */
        function checkDuplicateSupplierCode(newFornCode, currentProductCode) {
            const clean = String(newFornCode).trim().toUpperCase();
            const curr = String(currentProductCode).trim().toUpperCase();
            if (!clean) return { isDuplicate: false };

            const dupForn = rawFornecedoresProdutos.find(f => 
                String(f.codigo_fornecedor || '').trim().toUpperCase() === clean &&
                String(f.codigo_nosso || '').trim().toUpperCase() !== curr
            );
            if (dupForn) {
                return { isDuplicate: true, otherCode: dupForn.codigo_nosso };
            }

            return { isDuplicate: false };
        }

        /**
         * Salva ou atualiza o código de barras de um produto com validação e aviso de duplicidade
         */
        async function saveBarcodeForProduct(productCode, newBarcode) {
            const curr = String(productCode || '').trim().toUpperCase();
            const bar = String(newBarcode || '').trim().toUpperCase();

            if (!curr) {
                showAlert("Código do produto inválido.", "warning");
                return false;
            }

            // Verifica duplicidade com outro material
            const dupCheck = checkDuplicateBarcode(bar, curr);
            if (dupCheck.isDuplicate) {
                const otherDesc = getProductDescription(dupCheck.otherCode);
                const confirmed = confirm(
                    `⚠️ ATENÇÃO: CÓDIGO DE BARRAS REPETIDO!\n\n` +
                    `O código de barras "${bar}" já está cadastrado no material:\n` +
                    `• Código: ${dupCheck.otherCode}\n` +
                    `• Descrição: ${otherDesc}\n\n` +
                    `Deseja transferir/vincular este código de barras para o material atual (${curr})?`
                );
                if (!confirmed) {
                    showAlert("Vínculo cancelado pelo usuário.", "info");
                    return false;
                }

                // Limpa o código do outro produto
                const otherForn = rawFornecedoresProdutos.find(f => String(f.codigo_nosso).trim().toUpperCase() === dupCheck.otherCode);
                if (otherForn && otherForn.id) {
                    await supabaseClient.from('fornecedores_produtos').update({ codigo_barras: null, updated_at: new Date().toISOString() }).eq('id', otherForn.id);
                    otherForn.codigo_barras = null;
                }
                await supabaseClient.from('sb1_comercio').update({ codigo_barras: null }).eq('codigo', dupCheck.otherCode);
                await supabaseClient.from('sb1_industria').update({ codigo_barras: null }).eq('codigo', dupCheck.otherCode);
            }

            // Salva / Atualiza no fornecedores_produtos
            const fornRecord = fornecedorByNossoMap[curr];
            if (fornRecord && fornRecord.id) {
                const { error: upErr } = await supabaseClient
                    .from('fornecedores_produtos')
                    .update({ codigo_barras: bar, updated_at: new Date().toISOString() })
                    .eq('id', fornRecord.id);
                if (upErr) throw upErr;
                fornRecord.codigo_barras = bar;
            } else {
                const { data: insData, error: insErr } = await supabaseClient
                    .from('fornecedores_produtos')
                    .insert([{
                        codigo_nosso: curr,
                        codigo_barras: bar,
                        codigo_fornecedor: '',
                        codigo_antigo: '',
                        updated_at: new Date().toISOString()
                    }])
                    .select();
                if (insErr) throw insErr;
                if (insData && insData.length > 0) {
                    rawFornecedoresProdutos.push(insData[0]);
                }
            }

            // Atualiza também nas tabelas SB1
            await supabaseClient.from('sb1_comercio').update({ codigo_barras: bar }).eq('codigo', curr);
            await supabaseClient.from('sb1_industria').update({ codigo_barras: bar }).eq('codigo', curr);

            // Atualiza memória local
            const pObj = rawSb1Dataset.find(p => String(p.Codigo || p.codigo).trim().toUpperCase() === curr);
            if (pObj) pObj.codigo_barras = bar;

            rebuildFornecedoresMaps();
            populateProductsDatalist();
            applyValidadeFilters();

            showAlert(`Código de barras "${bar}" vinculado com sucesso ao material ${curr}!`, "success");
            return true;
        }

        /**
         * Salva ou atualiza o código de fornecedor de um produto com validação e aviso de duplicidade
         */
        async function saveSupplierCodeForProduct(productCode, newSupplierCode) {
            const curr = String(productCode || '').trim().toUpperCase();
            const forn = String(newSupplierCode || '').trim().toUpperCase();

            if (!curr) {
                showAlert("Código do produto inválido.", "warning");
                return false;
            }

            // Verifica duplicidade com outro material
            const dupCheck = checkDuplicateSupplierCode(forn, curr);
            if (dupCheck.isDuplicate) {
                const otherDesc = getProductDescription(dupCheck.otherCode);
                const confirmed = confirm(
                    `⚠️ ATENÇÃO: CÓDIGO DE FORNECEDOR REPETIDO!\n\n` +
                    `O código de fornecedor "${forn}" já está cadastrado no material:\n` +
                    `• Código: ${dupCheck.otherCode}\n` +
                    `• Descrição: ${otherDesc}\n\n` +
                    `Deseja transferir/vincular este código de fornecedor para o material atual (${curr})?`
                );
                if (!confirmed) {
                    showAlert("Vínculo cancelado pelo usuário.", "info");
                    return false;
                }

                // Limpa o código de fornecedor do outro produto
                const otherForn = rawFornecedoresProdutos.find(f => String(f.codigo_nosso).trim().toUpperCase() === dupCheck.otherCode);
                if (otherForn && otherForn.id) {
                    await supabaseClient.from('fornecedores_produtos').update({ codigo_fornecedor: '', updated_at: new Date().toISOString() }).eq('id', otherForn.id);
                    otherForn.codigo_fornecedor = '';
                }
            }

            const fornRecord = fornecedorByNossoMap[curr];
            if (fornRecord && fornRecord.id) {
                const { error: upErr } = await supabaseClient
                    .from('fornecedores_produtos')
                    .update({ codigo_fornecedor: forn, updated_at: new Date().toISOString() })
                    .eq('id', fornRecord.id);
                if (upErr) throw upErr;
                fornRecord.codigo_fornecedor = forn;
            } else {
                const { data: insData, error: insErr } = await supabaseClient
                    .from('fornecedores_produtos')
                    .insert([{
                        codigo_nosso: curr,
                        codigo_fornecedor: forn,
                        codigo_barras: null,
                        codigo_antigo: '',
                        updated_at: new Date().toISOString()
                    }])
                    .select();
                if (insErr) throw insErr;
                if (insData && insData.length > 0) {
                    rawFornecedoresProdutos.push(insData[0]);
                }
            }

            rebuildFornecedoresMaps();
            populateProductsDatalist();
            applyValidadeFilters();

            showAlert(`Código de fornecedor "${forn}" vinculado com sucesso ao material ${curr}!`, "success");
            return true;
        }

        async function saveBarcodeFromModal() {
            const codeInp = document.getElementById('valInputCodigo');
            const barInp = document.getElementById('valInputCodBarras');
            if (!codeInp || !barInp) return;

            const curr = codeInp.value.trim().toUpperCase();
            const bar = barInp.value.trim().toUpperCase();

            if (!curr) {
                showAlert("Informe o código do material primeiro.", "warning");
                return;
            }
            if (!bar) {
                showAlert("Digite ou bipe o código de barras.", "warning");
                return;
            }

            try {
                await saveBarcodeForProduct(curr, bar);
            } catch(e) {
                console.error("Erro ao salvar código de barras:", e);
                showAlert("Erro ao salvar código de barras no Supabase.", "error");
            }
        }

        async function saveSupplierCodeFromModal() {
            const codeInp = document.getElementById('valInputCodigo');
            const fornInp = document.getElementById('valInputCodFornecedor');
            if (!codeInp || !fornInp) return;

            const curr = codeInp.value.trim().toUpperCase();
            const forn = fornInp.value.trim().toUpperCase();

            if (!curr) {
                showAlert("Informe o código do material primeiro.", "warning");
                return;
            }
            if (!forn) {
                showAlert("Informe o código de fornecedor.", "warning");
                return;
            }

            try {
                await saveSupplierCodeForProduct(curr, forn);
            } catch(e) {
                console.error("Erro ao salvar código de fornecedor:", e);
                showAlert("Erro ao salvar código de fornecedor no Supabase.", "error");
            }
        }

        function scanBarcodeForModalBarcodeField() {
            openCameraScanner((decodedText) => {
                if (!decodedText) return;
                let scanned = String(decodedText).trim();
                if (scanned.startsWith('AMAZON_ACO|')) {
                    const parts = scanned.split('|');
                    if (parts.length >= 4) scanned = parts[3].trim();
                }
                const cleanBar = scanned.toUpperCase();
                const inp = document.getElementById('valInputCodBarras');
                if (inp) {
                    inp.value = cleanBar;
                }
                showAlert(`Código de barras "${cleanBar}" capturado! Clique em "Salvar" para confirmar o vínculo ao material.`, "info");
            }, { title: "Bipar Código de Barras / QR Code" });
        }

        /**
         * Retorna o saldo do ERP no armazém da filial para um determinado produto
         */
        function getSystemBalance(filial, armazem, produto) {
            const filPad = String(filial || '01').trim().padStart(2, '0');
            const filRaw = String(filial || '1').trim().replace(/^0+/, '');
            const armPad = String(armazem || '01').trim().padStart(2, '0');
            const armRaw = String(armazem || '1').trim().replace(/^0+/, '');
            const prod = String(produto || '').trim().toUpperCase();

            if (!rawSaldoDataset || rawSaldoDataset.length === 0) return 0;

            const row = rawSaldoDataset.find(s => 
                (s.filial === filPad || s.filial === filRaw) &&
                (s.armazem === armPad || s.armazem === armRaw) &&
                s.produto === prod
            );

            return row ? parseFloat(row.quantidade || 0) : 0;
        }

        /**
         * Retorna a somatória de todos os lotes cadastrados para um produto na filial e armazém
         */
        function getTotalBatchesQuantity(filial, armazem, produto) {
            const filPad = String(filial || '01').trim().padStart(2, '0');
            const filRaw = String(filial || '1').trim().replace(/^0+/, '');
            const armPad = String(armazem || '01').trim().padStart(2, '0');
            const armRaw = String(armazem || '1').trim().replace(/^0+/, '');
            const prod = String(produto || '').trim().toUpperCase();

            if (!rawValidadeDataset || rawValidadeDataset.length === 0) return 0;

            let total = 0;
            rawValidadeDataset.forEach(v => {
                const vFil = String(v.filial || '').trim();
                const vArm = String(v.armazem || '').trim();
                const vProd = String(v.produto || '').trim().toUpperCase();

                if ((vFil === filPad || vFil === filRaw) &&
                    (vArm === armPad || vArm === armRaw) &&
                    vProd === prod) {
                    total += parseFloat(v.quantidade || 0);
                }
            });

            return total;
        }

        /**
         * Retorna a comparação completa entre Soma dos Lotes e Saldo no Sistema
         */
        function getBalanceComparison(filial, armazem, produto) {
            const totalLotes = getTotalBatchesQuantity(filial, armazem, produto);
            const saldoSistema = getSystemBalance(filial, armazem, produto);
            const diff = totalLotes - saldoSistema;

            let status = 'ALINHADO';
            if (Math.abs(diff) > 0.0001) {
                if (saldoSistema === 0 && totalLotes > 0) {
                    status = 'EXCEDENTE';
                } else if (diff < 0) {
                    status = 'FALTA_LOTE';
                } else {
                    status = 'EXCEDENTE';
                }
            }

            return {
                totalLotes,
                saldoSistema,
                diff,
                status
            };
        }

        function isFilialMatch(itemFilial, filterFilial) {
            if (!filterFilial || filterFilial === 'ALL' || filterFilial === '00' || filterFilial === 'TODAS') return true;
            const fPad = String(itemFilial || '01').trim().padStart(2, '0');
            const fRaw = fPad.replace(/^0+/, '') || '0';
            const targetPad = String(filterFilial).trim().padStart(2, '0');
            const targetRaw = targetPad.replace(/^0+/, '') || '0';
            return fPad === targetPad || fRaw === targetRaw;
        }

        function isArmMatch(itemArm, filterArm) {
            if (!filterArm || filterArm === 'ALL') return true;
            const aPad = String(itemArm || '01').trim().padStart(2, '0');
            const aRaw = aPad.replace(/^0+/, '') || '0';
            const targetPad = String(filterArm).trim().padStart(2, '0');
            const targetRaw = targetPad.replace(/^0+/, '') || '0';
            return aPad === targetPad || aRaw === targetRaw;
        }

        function filterByStatusCard(targetStatus) {
            const sel = document.getElementById('valFilterStatus');
            if (!sel) return;
            if (sel.value === targetStatus) {
                sel.value = 'ALL';
            } else {
                sel.value = targetStatus;
            }
            applyValidadeFilters();
        }

        function filterResetAll() {
            const selS = document.getElementById('valFilterStatus');
            const selC = document.getElementById('valFilterSaldoConferencia');
            if (selS) selS.value = 'ALL';
            if (selC) selC.value = 'ALL';
            applyValidadeFilters();
        }

        function filterByDivergenceOnly() {
            const sel = document.getElementById('valFilterSaldoConferencia');
            if (sel) {
                sel.value = (sel.value === 'DIVERGENCIA') ? 'ALL' : 'DIVERGENCIA';
                applyValidadeFilters();
            }
        }

        function onFilialFilterChangeValidade() {
            updateKnownWarehousesForFilial();
            applyValidadeFilters();
        }

        function updateKnownWarehousesForFilial() {
            const filial = document.getElementById('valFilterFilial') ? document.getElementById('valFilterFilial').value : 'ALL';
            
            const saldoArmazens = rawSaldoDataset
                .filter(s => isFilialMatch(s.filial, filial))
                .map(s => String(s.armazem || '').trim().padStart(2, '0'))
                .filter(Boolean);

            const valArmazens = (rawValidadeDataset || [])
                .filter(v => isFilialMatch(v.filial, filial))
                .map(v => String(v.armazem || '').trim().padStart(2, '0'))
                .filter(Boolean);

            rawKnownWarehouses = [...new Set([...saldoArmazens, ...valArmazens])]
                .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

            if (rawKnownWarehouses.length === 0) {
                rawKnownWarehouses = ['01', '24', '50'];
            }

            populateWarehouseSelects();
        }

        function populateValidadeFiltersDropdowns() {
            const selFilial = document.getElementById('valFilterFilial');
            if (selFilial) {
                const isGlobal = isGlobalFilial(currentUser);
                const userAssigned = getTargetFilialForSector();

                if (isGlobal) {
                    selFilial.disabled = false;
                    selFilial.className = "w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 cursor-pointer";

                    const filials = [...new Set(rawValidadeDataset.map(v => v.filial))].sort();
                    const allAvailable = currentSector === 'INDUSTRIA' ? ['01', '02', '03', '04', '05', '06'] : getCachedFiliaisList().filter(f => f.num_filial !== '00').map(f => String(f.num_filial).padStart(2, '0'));
                    const merged = [...new Set([...allAvailable, ...filials])].sort();

                    const curVal = selFilial.value || 'ALL';
                    let html = '<option value="ALL">Todas as Filiais</option>';
                    merged.forEach(f => {
                        const name = getFilialDisplayName(f, currentSector === 'INDUSTRIA' ? 'industria' : 'comercio');
                        html += `<option value="${f}" ${f === curVal ? 'selected' : ''}>${name}</option>`;
                    });
                    selFilial.innerHTML = html;
                } else {
                    selFilial.disabled = true;
                    selFilial.className = "w-full bg-slate-100 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-600 cursor-not-allowed opacity-80";
                    const name = getFilialDisplayName(userAssigned, currentSector === 'INDUSTRIA' ? 'industria' : 'comercio');
                    selFilial.innerHTML = `<option value="${userAssigned}" selected>${name}</option>`;
                    selFilial.value = userAssigned;
                }
            }

            populateWarehouseSelects();
        }

        function populateWarehouseSelects() {
            // 1. Dropdown de Filtro de Armazém
            const selFilter = document.getElementById('valFilterArmazem');
            if (selFilter) {
                const currentVal = selFilter.value;
                let html = '<option value="ALL">Todos os Armazéns em Saldo</option>';
                rawKnownWarehouses.forEach(a => {
                    html += `<option value="${a}">Armazém ${a}</option>`;
                });
                selFilter.innerHTML = html;
                if (currentVal && (currentVal === 'ALL' || rawKnownWarehouses.includes(currentVal))) {
                    selFilter.value = currentVal;
                } else {
                    selFilter.value = 'ALL';
                }
            }

            // 2. Modal de Cadastro/Edição de Lote
            const selInput = document.getElementById('valInputArmazem');
            if (selInput) {
                const currentVal = selInput.value;
                let html = '';
                rawKnownWarehouses.forEach(a => {
                    html += `<option value="${a}">Armazém ${a}</option>`;
                });
                selInput.innerHTML = html;
                if (currentVal && rawKnownWarehouses.includes(currentVal)) {
                    selInput.value = currentVal;
                } else if (rawKnownWarehouses.length > 0) {
                    selInput.value = rawKnownWarehouses[0];
                }
            }

            // 3. Modal de Importação de Planilha
            const selImport = document.getElementById('importDefaultArmazem');
            if (selImport) {
                const currentVal = selImport.value;
                let html = '';
                rawKnownWarehouses.forEach(a => {
                    html += `<option value="${a}">Armazém ${a}</option>`;
                });
                selImport.innerHTML = html;
                if (rawKnownWarehouses.includes('24')) {
                    selImport.value = '24';
                } else if (currentVal && rawKnownWarehouses.includes(currentVal)) {
                    selImport.value = currentVal;
                } else if (rawKnownWarehouses.length > 0) {
                    selImport.value = rawKnownWarehouses[0];
                }
            }

            // 4. Modal de Transferência para Armazém Destino
            const selTransfer = document.getElementById('valTransferDestinoArmazem');
            if (selTransfer) {
                const currentVal = selTransfer.value;
                let html = '';
                rawKnownWarehouses.forEach(a => {
                    html += `<option value="${a}">Armazém ${a}</option>`;
                });
                selTransfer.innerHTML = html;
                if (rawKnownWarehouses.includes('50')) {
                    selTransfer.value = '50';
                } else if (currentVal && rawKnownWarehouses.includes(currentVal)) {
                    selTransfer.value = currentVal;
                } else if (rawKnownWarehouses.length > 0) {
                    selTransfer.value = rawKnownWarehouses[0];
                }
            }
        }

        function getValidadeStatus(dataValidadeStr) {
            if (!dataValidadeStr) return 'OK';
            const s = String(dataValidadeStr).trim();
            if (!/^\d{4}-\d{2}/.test(s)) return 'OK';
            
            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth() + 1;

            const parts = s.split('-');
            const valYear = parseInt(parts[0], 10);
            const valMonth = parseInt(parts[1], 10);

            const currentTotalMonths = currentYear * 12 + currentMonth;
            const valTotalMonths = valYear * 12 + valMonth;

            const diffMonths = valTotalMonths - currentTotalMonths;

            if (diffMonths < 0) {
                return 'VENCIDO';
            } else if (diffMonths <= 2) {
                return 'AVENCER';
            } else {
                return 'OK';
            }
        }

        function formatAnoMesDisplay(anoMesStr) {
            if (!anoMesStr) return '-';
            const s = String(anoMesStr).trim();
            if (!/^\d{4}-\d{2}/.test(s)) return s;
            const parts = s.split('-');
            const ano = parts[0];
            const mes = parts[1];
            const dia = parts.length > 2 ? parts[2].slice(0, 2) : null;
            const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
            const idx = parseInt(mes, 10) - 1;
            const mesNome = meses[idx] || mes;
            return dia ? `${dia}/${mesNome}/${ano}` : `${mesNome}/${ano}`;
        }

        function getValidadeStatusText(status) {
            if (status === 'VENCIDO') return 'Vencido';
            if (status === 'AVENCER') return 'A Vencer (60d)';
            return 'No Prazo (OK)';
        }

        function sortValidadeDataset(list) {
            if (!Array.isArray(list)) return [];
            return list.sort((a, b) => {
                // 1. Filial ASC
                const filA = String(a.filial || '').trim();
                const filB = String(b.filial || '').trim();
                const compFil = filA.localeCompare(filB, undefined, { numeric: true, sensitivity: 'base' });
                if (compFil !== 0) return compFil;

                // 2. Status ASC (Vencido -> A Vencer -> No Prazo)
                const statusOrder = { 'VENCIDO': 1, 'AVENCER': 2, 'OK': 3 };
                const stA = statusOrder[getValidadeStatus(a.data_validade)] || 4;
                const stB = statusOrder[getValidadeStatus(b.data_validade)] || 4;
                if (stA !== stB) return stA - stB;

                // 3. Código do Produto ASC
                const prodA = String(a.produto || '').trim();
                const prodB = String(b.produto || '').trim();
                const compProd = prodA.localeCompare(prodB, undefined, { numeric: true, sensitivity: 'base' });
                if (compProd !== 0) return compProd;

                // 4. Lote ASC
                const loteA = String(a.lote || '').trim();
                const loteB = String(b.lote || '').trim();
                const compLote = loteA.localeCompare(loteB, undefined, { numeric: true, sensitivity: 'base' });
                if (compLote !== 0) return compLote;

                // 5. Armazém ASC
                const armA = String(a.armazem || '').trim();
                const armB = String(b.armazem || '').trim();
                return armA.localeCompare(armB, undefined, { numeric: true, sensitivity: 'base' });
            });
        }

        let groupedValidadeDataset = [];
        let currentProductLotsData = null;
        let currentA4PalletData = null;

        function groupValidadeDatasetByProduct(validadeList) {
            const map = new Map();

            validadeList.forEach(v => {
                const f = String(v.filial || '01').trim().padStart(2, '0');
                const a = String(v.armazem || '01').trim().padStart(2, '0');
                const p = String(v.produto || '').trim().toUpperCase();
                const key = `${f}__${a}__${p}`;

                if (!map.has(key)) {
                    map.set(key, {
                        filial: f,
                        armazem: a,
                        produto: p,
                        lotes: [],
                        totalLotes: 0,
                        saldoSistema: getSystemBalance(f, a, p),
                        statusGeral: 'OK'
                    });
                }

                const item = map.get(key);
                item.lotes.push(v);
                item.totalLotes += parseFloat(v.quantidade || 0);

                const lotStatus = getValidadeStatus(v.data_validade);
                if (lotStatus === 'VENCIDO') {
                    item.statusGeral = 'VENCIDO';
                } else if (lotStatus === 'AVENCER' && item.statusGeral !== 'VENCIDO') {
                    item.statusGeral = 'AVENCER';
                }
            });

            const result = [];
            map.forEach(item => {
                item.diff = item.totalLotes - item.saldoSistema;
                let status = 'ALINHADO';
                if (Math.abs(item.diff) > 0.0001) {
                    if (item.saldoSistema === 0 && item.totalLotes > 0) {
                        status = 'EXCEDENTE';
                    } else if (item.diff < 0) {
                        status = 'FALTA_LOTE';
                    } else {
                        status = 'EXCEDENTE';
                    }
                }
                item.statusConferencia = status;

                // Ordena os lotes do material pelo vencimento mais próximo
                item.lotes.sort((a, b) => (a.data_validade || '').localeCompare(b.data_validade || ''));
                result.push(item);
            });

            return result.sort((a, b) => {
                const compFil = a.filial.localeCompare(b.filial, undefined, { numeric: true });
                if (compFil !== 0) return compFil;

                const statusOrder = { 'VENCIDO': 1, 'AVENCER': 2, 'OK': 3 };
                const stA = statusOrder[a.statusGeral] || 4;
                const stB = statusOrder[b.statusGeral] || 4;
                if (stA !== stB) return stA - stB;

                return a.produto.localeCompare(b.produto, undefined, { numeric: true });
            });
        }

        function applyValidadeFilters() {
            const filial = document.getElementById('valFilterFilial') ? document.getElementById('valFilterFilial').value : 'ALL';
            const armazem = document.getElementById('valFilterArmazem') ? document.getElementById('valFilterArmazem').value : 'ALL';
            const statusFilter = document.getElementById('valFilterStatus') ? document.getElementById('valFilterStatus').value : 'ALL';
            const confFilter = document.getElementById('valFilterSaldoConferencia') ? document.getElementById('valFilterSaldoConferencia').value : 'ALL';
            const search = document.getElementById('valFilterSearch') ? document.getElementById('valFilterSearch').value.trim().toLowerCase() : '';

            const sb1Map = {};
            rawSb1Dataset.forEach(p => {
                const c = p.Codigo;
                if (c) sb1Map[c] = p['Descr.Espec.'] || '-';
            });

            // 1. Escopo Base (Filial + Armazém + Busca) para cálculo dos cards e KPIs
            const baseScopeDataset = rawValidadeDataset.filter(v => {
                if (!isFilialMatch(v.filial, filial)) return false;
                if (!isArmMatch(v.armazem, armazem)) return false;

                if (search) {
                    const desc = (sb1Map[v.produto] || '').toLowerCase();
                    const fornInfo = fornecedorByNossoMap[v.produto];
                    const fornCode = fornInfo ? String(fornInfo.codigo_fornecedor || '').toLowerCase() : '';
                    const barCode = fornInfo ? String(fornInfo.codigo_barras || '').toLowerCase() : '';
                    const antCode = fornInfo ? String(fornInfo.codigo_antigo || '').toLowerCase() : '';
                    const pObj = rawSb1Dataset.find(p => String(p.Codigo || p.codigo).trim().toUpperCase() === v.produto);
                    const sbBarCode = pObj ? String(pObj.codigo_barras || '').toLowerCase() : '';

                    const matchesCode = v.produto.toLowerCase().includes(search);
                    const matchesDesc = desc.includes(search);
                    const matchesForn = fornCode.includes(search);
                    const matchesBarras = barCode.includes(search) || sbBarCode.includes(search);
                    const matchesAntigo = antCode.includes(search);
                    const matchesLote = (v.lote || '').toLowerCase().includes(search);
                    const matchesEmbalagem = (v.embalagem || '').toLowerCase().includes(search);
                    const matchesObs = (v.observacao || '').toLowerCase().includes(search);

                    if (!matchesCode && !matchesDesc && !matchesForn && !matchesBarras && !matchesAntigo && !matchesLote && !matchesEmbalagem && !matchesObs) return false;
                }
                return true;
            });

            // 2. Agrupamento por Produto
            const groupedList = groupValidadeDatasetByProduct(baseScopeDataset);

            // 3. Filtro Completo para a Tabela Agrupada (incluindo Status e Conferência de Saldos)
            const unSorted = groupedList.filter(item => {
                if (statusFilter !== 'ALL') {
                    const hasLotWithStatus = item.lotes.some(l => getValidadeStatus(l.data_validade) === statusFilter);
                    if (!hasLotWithStatus && item.statusGeral !== statusFilter) return false;
                }

                if (confFilter === 'DIVERGENCIA' && item.statusConferencia === 'ALINHADO') return false;
                if (confFilter === 'FALTA_LOTE' && item.statusConferencia !== 'FALTA_LOTE') return false;
                if (confFilter === 'EXCEDENTE' && item.statusConferencia !== 'EXCEDENTE') return false;
                if (confFilter === 'ALINHADO' && item.statusConferencia !== 'ALINHADO') return false;

                return true;
            });

            groupedValidadeDataset = unSorted;
            filteredValidadeDataset = unSorted;

            renderValidadeDashboard(baseScopeDataset, unSorted, statusFilter, confFilter);
            renderValidadeTable();
        }

        function renderValidadeDashboard(baseScopeDataset, filteredList, activeStatus, activeConf) {
            const list = Array.isArray(baseScopeDataset) ? baseScopeDataset : rawValidadeDataset;
            const fullFiltered = Array.isArray(filteredList) ? filteredList : groupedValidadeDataset;
            const status = activeStatus || (document.getElementById('valFilterStatus') ? document.getElementById('valFilterStatus').value : 'ALL');
            const conf = activeConf || (document.getElementById('valFilterSaldoConferencia') ? document.getElementById('valFilterSaldoConferencia').value : 'ALL');

            // Mapa SB1 para resolver Unidades de Medida
            const sb1Map = {};
            rawSb1Dataset.forEach(p => {
                const c = p.Codigo || p.codigo;
                if (c) {
                    sb1Map[String(c).trim().toUpperCase()] = {
                        descricao: p['Descr.Espec.'] || p.descricao || '-',
                        unidade: (p.Unidade || p.unidade || 'UN').trim().toUpperCase()
                    };
                }
            });

            let vencidosCount = 0;
            let aVencerCount = 0;
            let okCount = 0;
            let totalKg = 0;
            let totalPc = 0;
            let totalLt = 0;

            list.forEach(v => {
                const st = getValidadeStatus(v.data_validade);
                if (st === 'VENCIDO') vencidosCount++;
                else if (st === 'AVENCER') aVencerCount++;
                else okCount++;

                const prodCode = String(v.produto || '').trim().toUpperCase();
                const uInfo = sb1Map[prodCode] || { unidade: 'UN' };
                const u = uInfo.unidade || 'UN';
                const q = parseFloat(v.quantidade || 0);

                if (u === 'KG') {
                    totalKg += q;
                } else if (u === 'PC' || u === 'PÇ' || u === 'UN' || u === 'CX' || u === 'RL') {
                    totalPc += q;
                } else if (u === 'L' || u === 'LT' || u === 'GL') {
                    totalLt += q;
                } else {
                    totalPc += q;
                }
            });

            let filteredKg = 0;
            let filteredPc = 0;
            let filteredLt = 0;
            fullFiltered.forEach(item => {
                const prodCode = String(item.produto || '').trim().toUpperCase();
                const uInfo = sb1Map[prodCode] || { unidade: 'UN' };
                const u = uInfo.unidade || 'UN';
                const q = parseFloat(item.totalLotes || 0);

                if (u === 'KG') {
                    filteredKg += q;
                } else if (u === 'PC' || u === 'PÇ' || u === 'UN' || u === 'CX' || u === 'RL') {
                    filteredPc += q;
                } else if (u === 'L' || u === 'LT' || u === 'GL') {
                    filteredLt += q;
                } else {
                    filteredPc += q;
                }
            });

            const filial = document.getElementById('valFilterFilial') ? document.getElementById('valFilterFilial').value : 'ALL';
            const armazem = document.getElementById('valFilterArmazem') ? document.getElementById('valFilterArmazem').value : 'ALL';

            // Contagem de divergências únicas por material + armazém + filial dentro do escopo selecionado
            const uniqueMaterialsMap = new Map();

            list.forEach(v => {
                const key = `${v.filial}__${v.armazem}__${v.produto.toUpperCase()}`;
                if (!uniqueMaterialsMap.has(key)) {
                    const comp = getBalanceComparison(v.filial, v.armazem, v.produto);
                    uniqueMaterialsMap.set(key, comp);
                }
            });

            rawSaldoDataset.forEach(s => {
                if (!isFilialMatch(s.filial, filial)) return;
                if (!isArmMatch(s.armazem, armazem)) return;
                if (s.quantidade > 0) {
                    const key = `${s.filial}__${s.armazem}__${s.produto.toUpperCase()}`;
                    if (!uniqueMaterialsMap.has(key)) {
                        const comp = getBalanceComparison(s.filial, s.armazem, s.produto);
                        uniqueMaterialsMap.set(key, comp);
                    }
                }
            });

            let divergenciasCount = 0;
            let faltaCount = 0;
            let excessoCount = 0;
            uniqueMaterialsMap.forEach(comp => {
                if (comp.status !== 'ALINHADO') {
                    divergenciasCount++;
                    if (comp.status === 'FALTA_LOTE') faltaCount++;
                    else excessoCount++;
                }
            });

            const kpiV = document.getElementById('kpiValidadeVencidos');
            const kpiA = document.getElementById('kpiValidadeAVencer');
            const kpiOK = document.getElementById('kpiValidadeOK');
            const kpiTotal = document.getElementById('kpiValidadeTotalQtd');
            const kpiTotalSub = document.getElementById('kpiValidadeTotalQtdSub');
            const kpiDiv = document.getElementById('kpiValidadeDivergencias');
            const kpiDivSub = document.getElementById('kpiValidadeDivergenciasSub');

            if (kpiV) kpiV.innerText = vencidosCount.toLocaleString('pt-BR');
            if (kpiA) kpiA.innerText = aVencerCount.toLocaleString('pt-BR');
            if (kpiOK) kpiOK.innerText = okCount.toLocaleString('pt-BR');

            if (kpiTotal) {
                const isFiltered = (status !== 'ALL' || conf !== 'ALL');
                const displayKg = isFiltered ? filteredKg : totalKg;
                const displayPc = isFiltered ? filteredPc : totalPc;
                const displayLt = isFiltered ? filteredLt : totalLt;

                const displayParts = [];
                if (displayKg > 0 || (displayPc === 0 && displayLt === 0)) {
                    displayParts.push(`<span>${displayKg.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} <span class="text-[11px] font-bold text-slate-500">KG</span></span>`);
                }
                if (displayPc > 0) {
                    displayParts.push(`<span>${displayPc.toLocaleString('pt-BR')} <span class="text-[11px] font-bold text-slate-500">PC</span></span>`);
                }
                if (displayLt > 0) {
                    displayParts.push(`<span>${displayLt.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} <span class="text-[11px] font-bold text-slate-500">L</span></span>`);
                }

                kpiTotal.innerHTML = displayParts.join('<span class="text-slate-300 font-bold">•</span>');

                if (kpiTotalSub) {
                    if (isFiltered) {
                        const totalSummary = [];
                        if (totalKg > 0) totalSummary.push(`${totalKg.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg`);
                        if (totalPc > 0) totalSummary.push(`${totalPc.toLocaleString('pt-BR')} pc`);
                        if (totalLt > 0) totalSummary.push(`${totalLt.toLocaleString('pt-BR')} L`);
                        kpiTotalSub.innerText = `Filtrado (Escopo: ${totalSummary.join(' + ')})`;
                    } else {
                        kpiTotalSub.innerText = "Qtd. total monitorada";
                    }
                }
            }

            if (kpiDiv) {
                kpiDiv.innerText = divergenciasCount.toLocaleString('pt-BR');
                if (divergenciasCount === 0) {
                    kpiDiv.className = "text-2xl font-black text-emerald-600 mt-1";
                    if (kpiDivSub) kpiDivSub.innerText = "Saldos 100% Alinhados";
                } else {
                    kpiDiv.className = "text-2xl font-black text-purple-700 mt-1";
                    if (kpiDivSub) kpiDivSub.innerText = `${faltaCount} falta(m) | ${excessoCount} sobra(m)`;
                }
            }

            // --- CÁLCULOS FINANCEIROS DE VALIDADE (R$) & SEPARAÇÃO DE PESO/QUANTIDADE ---
            let valorTotalGeral = 0;
            let valorProtegidoGeral = 0;
            let valorVencidoGeral = 0;
            let pesoKgGeral = 0;
            let pesoPcGeral = 0;
            let pesoLtGeral = 0;

            (rawValidadeDataset || []).forEach(v => {
                const qtd = Number(v.quantidade || 0);
                const prodCode = String(v.produto || '').trim().toUpperCase();
                const uInfo = sb1Map[prodCode] || { unidade: 'UN' };
                const u = uInfo.unidade || 'UN';

                if (u === 'KG') {
                    pesoKgGeral += qtd;
                } else if (u === 'PC' || u === 'PÇ' || u === 'UN' || u === 'CX' || u === 'RL') {
                    pesoPcGeral += qtd;
                } else if (u === 'L' || u === 'LT' || u === 'GL') {
                    pesoLtGeral += qtd;
                } else {
                    pesoPcGeral += qtd;
                }

                const precoUnit = (typeof globalSd2PricesMap !== 'undefined' && globalSd2PricesMap[v.produto]) ? globalSd2PricesMap[v.produto] : 24.50;
                const vlr = qtd * precoUnit;
                valorTotalGeral += vlr;

                const st = getValidadeStatus(v.data_validade);
                if (st === 'OK' || st === 'AVENCER') {
                    valorProtegidoGeral += vlr;
                } else if (st === 'VENCIDO') {
                    valorVencidoGeral += vlr;
                }
            });

            const elValTotal = document.getElementById('kpiValidadeValorTotal');
            const elPesoTotal = document.getElementById('kpiValidadePesoTotal');
            const elValProt = document.getElementById('kpiValidadeValorProtegido');
            const elValVenc = document.getElementById('kpiValidadeValorVencido');

            if (elValTotal) elValTotal.innerText = valorTotalGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            if (elPesoTotal) {
                const parts = [];
                if (pesoKgGeral > 0) parts.push(`${pesoKgGeral.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg`);
                if (pesoPcGeral > 0) parts.push(`${pesoPcGeral.toLocaleString('pt-BR')} pçs`);
                if (pesoLtGeral > 0) parts.push(`${pesoLtGeral.toLocaleString('pt-BR')} L`);
                elPesoTotal.innerText = parts.length > 0 ? `${parts.join(' • ')} monitorados` : '0 monitorados';
            }
            if (elValProt) elValProt.innerText = valorProtegidoGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            if (elValVenc) elValVenc.innerText = valorVencidoGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

            updateKpiCardsVisualState(status, conf);
        }

        function updateKpiCardsVisualState(activeStatus, activeConf) {
            const cardV = document.getElementById('cardKpiVencidos');
            const cardA = document.getElementById('cardKpiAVencer');
            const cardOK = document.getElementById('cardKpiOK');
            const cardTotal = document.getElementById('cardKpiTotal');
            const cardDiv = document.getElementById('cardKpiDivergencias');

            const resetCard = (card) => {
                if (!card) return;
                card.classList.remove('ring-2', 'ring-offset-2', 'ring-rose-500', 'ring-amber-500', 'ring-emerald-500', 'ring-blue-500', 'ring-purple-500', 'bg-rose-50/70', 'bg-amber-50/70', 'bg-emerald-50/70', 'bg-blue-50/70', 'bg-purple-50/70');
            };

            resetCard(cardV);
            resetCard(cardA);
            resetCard(cardOK);
            resetCard(cardTotal);
            resetCard(cardDiv);

            if (activeStatus === 'VENCIDO' && cardV) {
                cardV.classList.add('ring-2', 'ring-offset-2', 'ring-rose-500', 'bg-rose-50/70');
            } else if (activeStatus === 'AVENCER' && cardA) {
                cardA.classList.add('ring-2', 'ring-offset-2', 'ring-amber-500', 'bg-amber-50/70');
            } else if (activeStatus === 'OK' && cardOK) {
                cardOK.classList.add('ring-2', 'ring-offset-2', 'ring-emerald-500', 'bg-emerald-50/70');
            }

            if (activeConf === 'DIVERGENCIA' && cardDiv) {
                cardDiv.classList.add('ring-2', 'ring-offset-2', 'ring-purple-500', 'bg-purple-50/70');
            }
        }

        function renderValidadeTable() {
            const tbody = document.getElementById('validadeTableBody');
            const mobileList = document.getElementById('validadeMobileList');

            if (tbody) tbody.innerHTML = '';
            if (mobileList) mobileList.innerHTML = '';

            const sb1Map = {};
            rawSb1Dataset.forEach(p => {
                const c = p.Codigo;
                if (c) sb1Map[c] = {
                    descricao: p['Descr.Espec.'] || '-',
                    unidade: p.Unidade ? String(p.Unidade).trim().toUpperCase() : 'UN'
                };
            });

            if (groupedValidadeDataset.length === 0) {
                if (tbody) {
                    tbody.innerHTML = `<tr><td colspan="10" class="px-4 py-8 text-center text-xs font-bold text-slate-400">Nenhum produto com lotes ou validade encontrado com os filtros selecionados.</td></tr>`;
                }
                if (mobileList) {
                    mobileList.innerHTML = `<div class="p-8 text-center text-xs font-bold text-slate-400 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">Nenhum produto com lotes ou validade encontrado com os filtros selecionados.</div>`;
                }
                return;
            }

            groupedValidadeDataset.forEach(item => {
                let badgeHtml = '';
                if (item.statusGeral === 'VENCIDO') {
                    badgeHtml = `<span class="px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 flex items-center justify-center gap-1"><i data-lucide="alert-triangle" class="w-3 h-3"></i> Vencido</span>`;
                } else if (item.statusGeral === 'AVENCER') {
                    badgeHtml = `<span class="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 flex items-center justify-center gap-1"><i data-lucide="clock" class="w-3 h-3"></i> A Vencer (60d)</span>`;
                } else {
                    badgeHtml = `<span class="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 flex items-center justify-center gap-1"><i data-lucide="check-circle-2" class="w-3 h-3"></i> No Prazo (OK)</span>`;
                }

                const sbInfo = sb1Map[item.produto] || { descricao: 'Material Não Cadastrado no SB1', unidade: 'UN' };
                const desc = sbInfo.descricao;
                const unidade = sbInfo.unidade;

                const armLabel = item.armazem === '50' 
                    ? `<span class="px-2 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">Armazém 50</span>` 
                    : (item.armazem === '99' ? `<span class="px-2 py-0.5 rounded text-[10px] font-black bg-slate-100 text-slate-800 border border-slate-200">Armazém 99</span>` : `Armazém ${item.armazem}`);

                // Chips dos lotes do produto (até 3 visíveis na listagem)
                let lotChipsHtml = '';
                const maxPreviewLots = 3;
                const visibleLots = item.lotes.slice(0, maxPreviewLots);
                visibleLots.forEach(l => {
                    const lSt = getValidadeStatus(l.data_validade);
                    let chipCls = "bg-slate-100 text-slate-700 border-slate-200";
                    if (lSt === 'VENCIDO') chipCls = "bg-rose-50 text-rose-800 border-rose-200";
                    else if (lSt === 'AVENCER') chipCls = "bg-amber-50 text-amber-800 border-amber-200";

                    lotChipsHtml += `<span class="px-1.5 py-0.5 rounded text-[9px] font-bold border ${chipCls}">${l.lote || 'S/L'}: ${Number(l.quantidade || 0).toLocaleString('pt-BR')} (${formatAnoMesDisplay(l.data_validade)})</span>`;
                });
                if (item.lotes.length > maxPreviewLots) {
                    lotChipsHtml += `<span class="text-[9px] font-bold text-slate-400">+${item.lotes.length - maxPreviewLots} outro(s)</span>`;
                }

                // Badge de Conferência
                let conferenciaBadgeHtml = '';
                if (item.statusConferencia === 'ALINHADO') {
                    conferenciaBadgeHtml = `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200" title="Soma dos lotes confere perfeitamente com o saldo ERP"><i data-lucide="check" class="w-3.5 h-3.5"></i> Alinhado (100%)</span>`;
                } else if (item.statusConferencia === 'FALTA_LOTE') {
                    const diffAbs = Math.abs(item.diff).toLocaleString('pt-BR');
                    conferenciaBadgeHtml = `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 animate-pulse" title="Falta cadastrar lote de ${diffAbs} para igualar ao saldo no sistema"><i data-lucide="alert-circle" class="w-3.5 h-3.5 text-amber-700"></i> Falta ${diffAbs} ${unidade}</span>`;
                } else {
                    const diffAbs = item.diff.toLocaleString('pt-BR');
                    conferenciaBadgeHtml = `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-100 text-rose-900 border border-rose-300 animate-pulse" title="Soma dos lotes excede o saldo no sistema em +${diffAbs}"><i data-lucide="alert-triangle" class="w-3.5 h-3.5 text-rose-700"></i> Excede +${diffAbs} ${unidade}</span>`;
                }

                const fornInfo = fornecedorByNossoMap[item.produto];
                const pObj = rawSb1Dataset.find(p => String(p.Codigo || p.codigo).trim().toUpperCase() === item.produto);
                const barCode = (fornInfo && fornInfo.codigo_barras) || (pObj && pObj.codigo_barras);

                let externalCodesHtml = '';
                if (fornInfo && fornInfo.codigo_fornecedor) {
                    externalCodesHtml += `<span class="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-bold" title="Código do Fornecedor"><i data-lucide="tag" class="w-2.5 h-2.5"></i> Forn: ${fornInfo.codigo_fornecedor}</span>`;
                }
                if (barCode) {
                    externalCodesHtml += `<span class="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded bg-purple-50 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-bold" title="Código de Barras / QR Code"><i data-lucide="barcode" class="w-2.5 h-2.5"></i> ${barCode}</span>`;
                }

                if (tbody) {
                    const tr = document.createElement('tr');
                    tr.className = "hover:bg-amber-50/40 dark:hover:bg-slate-700/60 border-b border-slate-100 dark:border-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer";
                    tr.onclick = (e) => {
                        if (e.target.closest('button')) return;
                        openProductLotsModal(item.filial, item.armazem, item.produto);
                    };
                    tr.innerHTML = `
                        <td class="px-3 py-3 text-xs font-bold text-slate-500">${item.filial}</td>
                        <td class="px-3 py-3 text-xs font-bold text-slate-700 dark:text-slate-300">${armLabel}</td>
                        <td class="px-3 py-3 text-xs font-black font-mono text-[#002f6c] dark:text-blue-400">
                            <div>${item.produto}</div>
                            ${externalCodesHtml ? `<div class="flex items-center gap-1 mt-1 flex-wrap">${externalCodesHtml}</div>` : ''}
                        </td>
                        <td class="px-4 py-3 text-xs font-black text-slate-800 dark:text-slate-100">
                            <div>${desc}</div>
                            <div class="flex items-center gap-1.5 mt-1 flex-wrap">${lotChipsHtml}</div>
                        </td>
                        <td class="px-3 py-3 text-right text-xs font-black text-slate-700 dark:text-slate-300">${item.saldoSistema.toLocaleString('pt-BR')} <span class="text-[10px] text-slate-400">${unidade}</span></td>
                        <td class="px-3 py-3 text-right text-xs font-black text-[#002f6c] dark:text-blue-400">${item.totalLotes.toLocaleString('pt-BR')} <span class="text-[10px] text-slate-400">${unidade}</span></td>
                        <td class="px-4 py-3 text-xs text-center">
                            ${conferenciaBadgeHtml}
                        </td>
                        <td class="px-3 py-3 text-center text-xs">
                            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-black bg-blue-50 dark:bg-blue-950 text-blue-900 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                <i data-lucide="boxes" class="w-3.5 h-3.5 text-blue-600 dark:text-blue-400"></i>
                                <span>${item.lotes.length} lote(s)</span>
                            </span>
                        </td>
                        <td class="px-3 py-3 text-center">${badgeHtml}</td>
                        <td class="px-3 py-3 text-center">
                            <div class="flex items-center justify-center gap-1.5">
                                <button type="button" onclick="openProductLotsModal('${item.filial}', '${item.armazem}', '${item.produto}')" class="bg-[#002f6c] hover:bg-[#00204a] text-white px-3 py-1.5 rounded-xl text-xs font-black shadow-sm flex items-center gap-1.5 touch-active" title="Gerenciar todos os lotes deste material">
                                    <i data-lucide="layers" class="w-3.5 h-3.5"></i>
                                    <span>Lotes (${item.lotes.length})</span>
                                </button>
                                <button type="button" onclick="openA4PalletPrintModal('${item.filial}', '${item.armazem}', '${item.produto}')" class="bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white p-1.5 rounded-xl text-xs transition-all shadow-sm touch-active" title="Imprimir Ficha A4 para Identificação de Palete">
                                    <i data-lucide="file-text" class="w-3.5 h-3.5"></i>
                                </button>
                                <button type="button" onclick="openItemAuditHistoryModal('${item.produto}', '${desc.replace(/'/g, "\\'")}', '${item.filial}', '${item.armazem}')" class="bg-slate-100 hover:bg-slate-700 text-slate-600 hover:text-white p-1.5 rounded-xl text-xs transition-all shadow-2xs touch-active cursor-pointer" title="Ver Histórico de Auditoria">
                                    <i data-lucide="history" class="w-3.5 h-3.5"></i>
                                </button>
                            </div>
                        </td>
                    `;
                    tbody.appendChild(tr);
                }

                if (mobileList) {
                    const card = document.createElement('div');
                    card.className = "bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-3 hover:border-slate-300 transition-colors cursor-pointer";
                    card.onclick = (e) => {
                        if (e.target.closest('button')) return;
                        openProductLotsModal(item.filial, item.armazem, item.produto);
                    };
                    card.innerHTML = `
                        <div class="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700 pb-2">
                            <div class="flex items-center gap-1.5 flex-wrap">
                                <span class="px-2 py-0.5 rounded-lg text-[11px] font-black font-mono bg-blue-50 dark:bg-blue-950 text-blue-900 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                    ${item.produto}
                                </span>
                                <span class="text-xs font-bold text-slate-500">
                                    Filial ${item.filial} • ${armLabel}
                                </span>
                                ${externalCodesHtml ? `<div class="flex items-center gap-1 mt-0.5 flex-wrap w-full">${externalCodesHtml}</div>` : ''}
                            </div>
                            <div>${badgeHtml}</div>
                        </div>

                        <div>
                            <h4 class="text-xs font-black text-slate-900 dark:text-white leading-snug">${desc}</h4>
                            <div class="flex items-center gap-1.5 mt-1.5 flex-wrap">${lotChipsHtml}</div>
                        </div>

                        <!-- Card de Comparação Saldo no Mobile -->
                        <div class="bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5 text-xs">
                            <div class="grid grid-cols-2 gap-2 text-center text-[10px] font-bold">
                                <div class="bg-white dark:bg-slate-800 p-1.5 rounded-lg border border-slate-100 dark:border-slate-700">
                                    <span class="text-slate-400 block text-[9px] uppercase">Saldo ERP</span>
                                    <b class="text-slate-800 dark:text-slate-200 text-xs">${item.saldoSistema.toLocaleString('pt-BR')} ${unidade}</b>
                                </div>
                                <div class="bg-white dark:bg-slate-800 p-1.5 rounded-lg border border-slate-100 dark:border-slate-700">
                                    <span class="text-slate-400 block text-[9px] uppercase">Soma Lotes (${item.lotes.length})</span>
                                    <b class="text-[#002f6c] dark:text-blue-400 text-xs">${item.totalLotes.toLocaleString('pt-BR')} ${unidade}</b>
                                </div>
                            </div>
                            <div class="flex justify-center pt-0.5">
                                ${conferenciaBadgeHtml}
                            </div>
                        </div>

                        <div class="flex items-center justify-end gap-2 pt-1">
                            <button type="button" onclick="openA4PalletPrintModal('${item.filial}', '${item.armazem}', '${item.produto}')" class="bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white px-3 py-2 rounded-xl text-xs font-black shadow-sm flex items-center gap-1.5 touch-active" title="Imprimir Ficha A4 para Palete">
                                <i data-lucide="file-text" class="w-4 h-4"></i>
                                <span>Ficha A4</span>
                            </button>
                            <button type="button" onclick="openItemAuditHistoryModal('${item.produto}', '${desc.replace(/'/g, "\\'")}', '${item.filial}', '${item.armazem}')" class="bg-slate-100 hover:bg-slate-700 text-slate-600 hover:text-white p-2 rounded-xl text-xs font-bold transition-all shadow-sm touch-active cursor-pointer" title="Ver Histórico">
                                <i data-lucide="history" class="w-4 h-4"></i>
                            </button>
                            <button type="button" onclick="openProductLotsModal('${item.filial}', '${item.armazem}', '${item.produto}')" class="flex-1 bg-[#002f6c] hover:bg-[#00204a] text-white py-2 rounded-xl text-xs font-black uppercase tracking-wider shadow-sm flex items-center justify-center space-x-1.5 touch-active">
                                <i data-lucide="layers" class="w-3.5 h-3.5"></i>
                                <span>Gerenciar Lotes (${item.lotes.length})</span>
                            </button>
                        </div>
                    `;
                    mobileList.appendChild(card);
                }
            });

            if (typeof lucide !== 'undefined') lucide.createIcons();
        }

        // --- GERENCIAMENTO DE LOTES POR PRODUTO (MODAL DEDICADO) ---

        function openProductLotsModal(filial, armazem, produto) {
            const f = String(filial || '01').padStart(2, '0');
            const a = String(armazem || '01').padStart(2, '0');
            const p = String(produto || '').trim().toUpperCase();

            currentProductLotsData = { filial: f, armazem: a, produto: p };
            renderProductLotsModal();

            const modal = document.getElementById('productLotsModal');
            if (modal) modal.classList.remove('pointer-events-none', 'opacity-0');
        }

        function closeProductLotsModal() {
            const modal = document.getElementById('productLotsModal');
            if (modal) modal.classList.add('pointer-events-none', 'opacity-0');
            currentProductLotsData = null;
        }

        function renderProductLotsModal() {
            if (!currentProductLotsData) return;
            const { filial, armazem, produto } = currentProductLotsData;

            const sbMatch = rawSb1Dataset ? rawSb1Dataset.find(item => String(item.Codigo).trim().toUpperCase() === produto) : null;
            const desc = sbMatch ? (sbMatch['Descr.Espec.'] || produto) : produto;
            const unidade = sbMatch && sbMatch.Unidade ? String(sbMatch.Unidade).trim().toUpperCase() : 'UN';

            const matchingLots = rawValidadeDataset.filter(v => 
                isFilialMatch(v.filial, filial) && 
                isArmMatch(v.armazem, armazem) && 
                String(v.produto).trim().toUpperCase() === produto
            ).sort((a, b) => (a.data_validade || '').localeCompare(b.data_validade || ''));

            const saldoERP = getSystemBalance(filial, armazem, produto);
            let totalLotes = 0;
            matchingLots.forEach(l => totalLotes += parseFloat(l.quantidade || 0));
            const diff = totalLotes - saldoERP;

            // Preenche cabeçalho
            const elCod = document.getElementById('plModalCodigo');
            const elDesc = document.getElementById('plModalDescricao');
            const elFilArm = document.getElementById('plModalFilialArmazem');
            const elBadge = document.getElementById('plModalStatusGeralBadge');

            if (elCod) elCod.innerText = produto;
            if (elDesc) elDesc.innerText = desc;
            if (elFilArm) elFilArm.innerText = `Filial ${filial} • Armazém ${armazem}`;

            let worstStatus = 'OK';
            matchingLots.forEach(l => {
                const st = getValidadeStatus(l.data_validade);
                if (st === 'VENCIDO') worstStatus = 'VENCIDO';
                else if (st === 'AVENCER' && worstStatus !== 'VENCIDO') worstStatus = 'AVENCER';
            });

            if (elBadge) {
                if (worstStatus === 'VENCIDO') {
                    elBadge.className = "px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-100 text-rose-800";
                    elBadge.innerText = "🔴 Lote(s) Vencido(s)";
                } else if (worstStatus === 'AVENCER') {
                    elBadge.className = "px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-800";
                    elBadge.innerText = "🟡 A Vencer (60d)";
                } else {
                    elBadge.className = "px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800";
                    elBadge.innerText = "🟢 No Prazo";
                }
            }

            // Comparativo de saldo
            const elSaldo = document.getElementById('plModalSaldoERP');
            const elSoma = document.getElementById('plModalSomaLotes');
            const elDiff = document.getElementById('plModalDiferenca');
            const fillBtnContainer = document.getElementById('plModalFillRemainingBtnContainer');
            const fillBtnLabel = document.getElementById('plModalFillRemainingLabel');

            if (elSaldo) elSaldo.innerText = `${saldoERP.toLocaleString('pt-BR')} ${unidade}`;
            if (elSoma) elSoma.innerText = `${totalLotes.toLocaleString('pt-BR')} ${unidade}`;
            
            if (elDiff) {
                if (Math.abs(diff) < 0.0001) {
                    elDiff.innerText = "0 (Alinhado)";
                    elDiff.className = "text-lg font-black text-emerald-600";
                } else if (diff < 0) {
                    elDiff.innerText = `Falta ${Math.abs(diff).toLocaleString('pt-BR')} ${unidade}`;
                    elDiff.className = "text-lg font-black text-amber-600 animate-pulse";
                } else {
                    elDiff.innerText = `Excede +${diff.toLocaleString('pt-BR')} ${unidade}`;
                    elDiff.className = "text-lg font-black text-rose-600 animate-pulse";
                }
            }

            if (fillBtnContainer) {
                if (diff < -0.0001) {
                    fillBtnContainer.classList.remove('hidden');
                    if (fillBtnLabel) fillBtnLabel.innerText = `Preencher Falta de ${Math.abs(diff).toLocaleString('pt-BR')} ${unidade}`;
                } else {
                    fillBtnContainer.classList.add('hidden');
                }
            }

            // Renderiza linhas da tabela e cards mobile
            const tbody = document.getElementById('plModalTableBody');
            const mobileList = document.getElementById('plModalMobileList');
            const elCount = document.getElementById('plModalLotsCount');
            if (elCount) elCount.innerText = `${matchingLots.length} lote/palete(s) cadastrado(s)`;

            if (tbody) tbody.innerHTML = '';
            if (mobileList) mobileList.innerHTML = '';

            if (matchingLots.length === 0) {
                if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-8 text-center text-xs font-bold text-slate-400">Nenhum lote ou palete registrado para este material neste armazém.</td></tr>`;
                if (mobileList) mobileList.innerHTML = `<div class="p-6 text-center text-xs font-bold text-slate-400">Nenhum lote ou palete registrado para este material neste armazém.</div>`;
            } else {
                matchingLots.forEach(lot => {
                    const lotSt = getValidadeStatus(lot.data_validade);
                    let badge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">No Prazo</span>`;
                    if (lotSt === 'VENCIDO') badge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800">Vencido</span>`;
                    else if (lotSt === 'AVENCER') badge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800">A Vencer</span>`;

                    const palletDisplay = lot.embalagem ? lot.embalagem : unidade;

                    if (tbody) {
                        const tr = document.createElement('tr');
                        tr.className = "hover:bg-slate-50 dark:hover:bg-slate-700/60 border-b border-slate-100 dark:border-slate-700";
                        tr.innerHTML = `
                            <td class="px-3 py-2.5 font-black text-slate-900 dark:text-white">
                                <span class="bg-blue-50 dark:bg-blue-950 text-blue-900 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded-lg text-xs font-black">${lot.lote || 'S/ LOTE'}</span>
                            </td>
                            <td class="px-3 py-2.5 font-extrabold text-indigo-700 dark:text-indigo-300">
                                <span class="bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800 px-2 py-0.5 rounded-lg text-[11px] font-black">📦 ${palletDisplay}</span>
                            </td>
                            <td class="px-3 py-2.5 text-right font-black text-[#002f6c] dark:text-blue-400 text-xs">${Number(lot.quantidade || 0).toLocaleString('pt-BR')} <span class="text-[10px] text-slate-400 font-bold">${unidade}</span></td>
                            <td class="px-3 py-2.5 text-center font-bold text-slate-500 text-xs">${formatAnoMesDisplay(lot.data_fabricacao)}</td>
                            <td class="px-3 py-2.5 text-center font-black text-slate-900 dark:text-white text-xs">${formatAnoMesDisplay(lot.data_validade)}</td>
                            <td class="px-3 py-2.5 text-center">${badge}</td>
                            <td class="px-3 py-2.5 text-[11px] text-slate-500 dark:text-slate-400 italic">${lot.observacao || '-'}</td>
                            <td class="px-3 py-2.5 text-center">
                                <div class="flex items-center justify-center gap-1.5">
                                    <button type="button" onclick="openEditValidadeModal(${lot.id})" class="bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white p-1.5 rounded-xl transition-all shadow-sm touch-active cursor-pointer" title="Editar este Palete/Lote">
                                        <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                                    </button>
                                    <button type="button" onclick="openTransferValidadeModal(${lot.id})" class="bg-amber-50 hover:bg-amber-600 text-amber-800 hover:text-white p-1.5 rounded-xl transition-all shadow-sm touch-active cursor-pointer" title="Mover para Armazém 50 (Vencidos)">
                                        <i data-lucide="truck" class="w-3.5 h-3.5"></i>
                                    </button>
                                    <button type="button" onclick="deleteValidadeEntry(${lot.id})" class="bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white p-1.5 rounded-xl transition-all shadow-sm touch-active cursor-pointer" title="Excluir este Palete/Lote">
                                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                                    </button>
                                </div>
                            </td>
                        `;
                        tbody.appendChild(tr);
                    }

                    if (mobileList) {
                        const mCard = document.createElement('div');
                        mCard.className = "bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs space-y-2.5";
                        mCard.innerHTML = `
                            <div class="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700 pb-2">
                                <div class="flex items-center gap-1.5 flex-wrap">
                                    <span class="bg-blue-50 dark:bg-blue-950 text-blue-900 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2.5 py-0.5 rounded-lg text-xs font-mono font-black">
                                        Lote: ${lot.lote || 'S/ LOTE'}
                                    </span>
                                    <span class="bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800 px-2 py-0.5 rounded-lg text-[10px] font-black">
                                        📦 ${palletDisplay}
                                    </span>
                                </div>
                                <div>${badge}</div>
                            </div>
                            <div class="grid grid-cols-2 gap-2 text-xs">
                                <div class="bg-slate-50 dark:bg-slate-900/60 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                                    <span class="text-[9px] uppercase font-bold text-slate-400 block">Quantidade</span>
                                    <b class="text-sm font-black text-[#002f6c] dark:text-blue-400">${Number(lot.quantidade || 0).toLocaleString('pt-BR')} ${unidade}</b>
                                </div>
                                <div class="bg-slate-50 dark:bg-slate-900/60 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                                    <span class="text-[9px] uppercase font-bold text-slate-400 block">Validade Final</span>
                                    <b class="text-sm font-black text-slate-800 dark:text-slate-100">${formatAnoMesDisplay(lot.data_validade)}</b>
                                </div>
                            </div>
                            <div class="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
                                <span>Fabricação: <b>${formatAnoMesDisplay(lot.data_fabricacao)}</b></span>
                                ${lot.observacao ? `<span class="italic truncate max-w-[150px] font-semibold">"${lot.observacao}"</span>` : ''}
                            </div>
                            <div class="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-700">
                                <button type="button" onclick="openEditValidadeModal(${lot.id})" class="px-3 py-1.5 bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-all">
                                    <i data-lucide="edit-3" class="w-3.5 h-3.5"></i> Editar
                                </button>
                                <button type="button" onclick="openTransferValidadeModal(${lot.id})" class="px-3 py-1.5 bg-amber-50 hover:bg-amber-600 text-amber-800 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-all">
                                    <i data-lucide="truck" class="w-3.5 h-3.5"></i> Vencidos
                                </button>
                                <button type="button" onclick="deleteValidadeEntry(${lot.id})" class="p-2 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white rounded-xl text-xs font-bold transition-all">
                                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                                </button>
                            </div>
                        `;
                        mobileList.appendChild(mCard);
                    }
                });
            }

            if (typeof lucide !== 'undefined') lucide.createIcons();
        }

        function openArgoxLabelsForAllProductPallets() {
            openA4PalletPrintModalFromProductLots();
        }

        function openNewValidadeModalForCurrentProduct() {
            if (!currentProductLotsData) return;
            openNewValidadeModal(currentProductLotsData.produto, currentProductLotsData.armazem, currentProductLotsData.filial);
        }

        function fillRemainingBalanceFromModal() {
            if (!currentProductLotsData) return;
            const { filial, armazem, produto } = currentProductLotsData;
            const comp = getBalanceComparison(filial, armazem, produto);
            if (comp.diff < 0) {
                openNewValidadeModal(produto, armazem, filial);
                const missingQtd = Math.abs(comp.diff);
                if (modalPalletRows.length > 0) {
                    modalPalletRows[0].qtd = missingQtd;
                    renderModalPalletRows();
                }
            }
        }

        // --- IMPRESSÃO DE FICHA DE PALETE EM FOLHA A4 COM SELETOR DE LOTES E FRACIONAMENTO ---

        function openA4PalletPrintModalFromProductLots() {
            if (!currentProductLotsData) return;
            openA4PalletPrintModal(currentProductLotsData.filial, currentProductLotsData.armazem, currentProductLotsData.produto);
        }

        function openA4PalletPrintModalWithSingleLot(lotId) {
            const lot = rawValidadeDataset.find(v => String(v.id) === String(lotId) || Number(v.id) === Number(lotId));
            if (!lot) return;
            openA4PalletPrintModal(lot.filial || '01', lot.armazem || '01', lot.produto, lot.quantidade, lot.lote, lot.data_validade, lot.embalagem, lot.id);
        }

        function openA4PalletPrintModal(filial, armazem, produto, initialTotalQtd, initialLote, initialValidade, initialEmbalagem, targetLotId) {
            const f = String(filial || '01').padStart(2, '0');
            const a = String(armazem || '01').padStart(2, '0');
            const p = String(produto || '').trim().toUpperCase();

            let matchingLots = rawValidadeDataset.filter(v => 
                isFilialMatch(v.filial, f) && 
                isArmMatch(v.armazem, a) && 
                String(v.produto).trim().toUpperCase() === p
            ).map(lot => ({ ...lot })).sort((lotA, lotB) => (lotA.data_validade || '').localeCompare(lotB.data_validade || ''));

            const sbMatch = rawSb1Dataset ? rawSb1Dataset.find(item => String(item.Codigo).trim().toUpperCase() === p) : null;
            const desc = sbMatch ? (sbMatch['Descr.Espec.'] || p) : p;
            const unidade = sbMatch && sbMatch.Unidade ? String(sbMatch.Unidade).trim().toUpperCase() : 'UN';

            if (matchingLots.length === 0 && initialTotalQtd) {
                matchingLots = [{
                    id: 'custom_1',
                    filial: f,
                    armazem: a,
                    produto: p,
                    lote: initialLote || '',
                    data_fabricacao: '',
                    data_validade: initialValidade || '',
                    quantidade: parseFloat(initialTotalQtd) || 0,
                    embalagem: initialEmbalagem || 'PALETE 1/1',
                    observacao: ''
                }];
            }

            currentA4PalletData = {
                filial: f,
                armazem: a,
                produto: p,
                descricao: desc,
                unidade: unidade,
                lotes: matchingLots
            };

            const codEl = document.getElementById('a4ModalCodigoDisplay');
            const descEl = document.getElementById('a4ModalDescricaoDisplay');
            const armEl = document.getElementById('a4ModalArmazemDisplay');
            const unEl = document.getElementById('a4ModalUnidadeDisplay');
            const u1 = document.getElementById('a4UnidadeDisplay1');
            const u2 = document.getElementById('a4UnidadeDisplay2');

            if (codEl) codEl.innerText = p;
            if (descEl) descEl.innerText = desc;
            if (armEl) armEl.innerText = `FILIAL: ${f} | ARM: ${a}`;
            if (unEl) unEl.innerText = unidade;
            if (u1) u1.innerText = unidade;
            if (u2) u2.innerText = unidade;

            const inputPerPallet = document.getElementById('a4InputQtdPorPallet');
            if (inputPerPallet) inputPerPallet.value = '';

            // Popula o seletor de lote a fracionar
            populateA4SplitLoteSelect(targetLotId);

            // Popula o seletor de paletes para filtro rápido na folha A4
            refreshA4QuickPalletFilterSelect();

            const headerInput = document.getElementById('a4PalletHeaderInput');
            if (headerInput) {
                headerInput.value = matchingLots.length === 1 && matchingLots[0].embalagem ? matchingLots[0].embalagem : 'IDENTIFICAÇÃO DE PALETE / ESTOQUE';
            }

            renderA4LotCheckboxes();

            const modal = document.getElementById('a4PrintModal');
            if (modal) modal.classList.remove('pointer-events-none', 'opacity-0');
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }

        function populateA4SplitLoteSelect(selectedLotId) {
            const select = document.getElementById('a4SplitLoteSelect');
            if (!select || !currentA4PalletData) return;

            const lots = currentA4PalletData.lotes || [];
            const u = currentA4PalletData.unidade || 'UN';

            let optionsHtml = '';
            if (lots.length > 1) {
                optionsHtml += `<option value="ALL">📦 Fracionar todos os lotes pela capacidade</option>`;
            }

            lots.forEach((lot) => {
                const loteLabel = lot.lote ? `Lote: ${lot.lote}` : 'S/ LOTE';
                const valLabel = lot.data_validade ? ` • Val: ${lot.data_validade}` : '';
                const embLabel = lot.embalagem ? ` [${lot.embalagem}]` : '';
                const qtdLabel = `${Number(lot.quantidade || 0).toLocaleString('pt-BR')} ${u}`;
                optionsHtml += `<option value="${lot.id}">🏷️ ${loteLabel}${embLabel} (${qtdLabel}${valLabel})</option>`;
            });

            select.innerHTML = optionsHtml;

            if (selectedLotId && lots.some(l => String(l.id) === String(selectedLotId))) {
                select.value = String(selectedLotId);
            } else if (lots.length === 1) {
                select.value = String(lots[0].id);
            } else {
                select.value = 'ALL';
            }

            onA4SplitLoteSelectChange();
        }

        function refreshA4QuickPalletFilterSelect() {
            const palletFilterSelect = document.getElementById('a4QuickPalletFilterSelect');
            if (!palletFilterSelect || !currentA4PalletData) return;

            const lots = currentA4PalletData.lotes || [];
            const uniquePallets = [...new Set(lots.map(l => (l.embalagem || 'PALETE').trim()).filter(Boolean))];
            let opts = `<option value="ALL">📋 Imprimir Todos os Lotes / Paletes (${lots.length})</option>`;
            uniquePallets.forEach(pal => {
                opts += `<option value="${pal}">📦 ${pal}</option>`;
            });
            palletFilterSelect.innerHTML = opts;
        }

        function onA4SplitLoteSelectChange() {
            if (!currentA4PalletData) return;
            const select = document.getElementById('a4SplitLoteSelect');
            const totalInput = document.getElementById('a4InputTotalQtd');
            if (!select || !totalInput) return;

            const val = select.value;
            const lots = currentA4PalletData.lotes || [];

            if (val === 'ALL') {
                const totalQtdSum = lots.reduce((acc, l) => acc + (parseFloat(l.quantidade) || 0), 0);
                totalInput.value = totalQtdSum > 0 ? totalQtdSum : '';
            } else {
                const targetLot = lots.find(l => String(l.id) === String(val));
                if (targetLot) {
                    totalInput.value = parseFloat(targetLot.quantidade) || '';
                }
            }

            onA4QuantityInputsChange();
        }

        function onA4QuantityInputsChange() {
            if (!currentA4PalletData) return;

            const select = document.getElementById('a4SplitLoteSelect');
            const totalInput = document.getElementById('a4InputTotalQtd');
            const perPalletInput = document.getElementById('a4InputQtdPorPallet');
            const summaryText = document.getElementById('a4SplitSummaryText');

            const splitMode = select ? select.value : 'ALL';
            const totalQtd = totalInput ? parseFloat(totalInput.value || 0) : 0;
            const perPallet = perPalletInput ? parseFloat(perPalletInput.value || 0) : 0;
            const u = currentA4PalletData.unidade || 'UN';

            if (splitMode === 'ALL') {
                if (perPallet > 0) {
                    summaryText.innerHTML = `📦 Cada lote será fracionado em paletes com até <b>${perPallet.toLocaleString('pt-BR')} ${u}</b>`;
                } else {
                    summaryText.innerText = `📦 Mantém cada lote em 1 palete com suas quantidades atuais`;
                }
            } else {
                const targetLot = currentA4PalletData.lotes.find(l => String(l.id) === String(splitMode));
                const loteNome = targetLot && targetLot.lote ? `Lote ${targetLot.lote}` : 'Lote Selecionado';

                if (totalQtd > 0 && perPallet > 0 && perPallet < totalQtd) {
                    const fullCount = Math.floor(totalQtd / perPallet);
                    const remainder = Math.round((totalQtd % perPallet) * 1000) / 1000;
                    const totalSlices = fullCount + (remainder > 0.0001 ? 1 : 0);

                    if (summaryText) {
                        summaryText.innerHTML = `📦 <b>${loteNome} em ${totalSlices} paletes:</b> ${fullCount}x de <b>${perPallet.toLocaleString('pt-BR')} ${u}</b>${remainder > 0 ? ` + 1x de <b>${remainder.toLocaleString('pt-BR')} ${u}</b>` : ''} (Total: ${totalQtd.toLocaleString('pt-BR')} ${u})`;
                    }
                } else {
                    if (summaryText) {
                        summaryText.innerHTML = `📦 <b>${loteNome}:</b> 1 palete com o total de ${totalQtd.toLocaleString('pt-BR')} ${u}`;
                    }
                }
            }
        }

        function applyA4AutoSplit() {
            if (!currentA4PalletData || !currentA4PalletData.lotes || currentA4PalletData.lotes.length === 0) return;

            const select = document.getElementById('a4SplitLoteSelect');
            const totalInput = document.getElementById('a4InputTotalQtd');
            const perPalletInput = document.getElementById('a4InputQtdPorPallet');

            const splitMode = select ? select.value : 'ALL';
            const totalQtd = totalInput ? parseFloat(totalInput.value || 0) : 0;
            const perPallet = perPalletInput ? parseFloat(perPalletInput.value || 0) : 0;

            if (perPallet <= 0) {
                showAlert("Informe a Quantidade por Palete/Folha desejada.", "warning");
                return;
            }

            if (splitMode === 'ALL') {
                // Fraciona cada lote da lista pela capacidade
                const newLots = [];

                currentA4PalletData.lotes.forEach(lot => {
                    const lotQtd = parseFloat(lot.quantidade || 0);
                    if (lotQtd > perPallet) {
                        const fullCount = Math.floor(lotQtd / perPallet);
                        const remainder = Math.round((lotQtd % perPallet) * 1000) / 1000;
                        const totalSlices = fullCount + (remainder > 0.0001 ? 1 : 0);

                        for (let i = 1; i <= fullCount; i++) {
                            newLots.push({
                                ...lot,
                                id: `${lot.id}_split_${i}_${Date.now()}`,
                                quantidade: perPallet,
                                embalagem: totalSlices > 1 ? `${u} ${i}/${totalSlices}` : u
                            });
                        }

                        if (remainder > 0.0001) {
                            newLots.push({
                                ...lot,
                                id: `${lot.id}_split_${totalSlices}_${Date.now()}`,
                                quantidade: remainder,
                                embalagem: `${u} ${totalSlices}/${totalSlices} (RESTO)`
                            });
                        }
                    } else {
                        newLots.push(lot);
                    }
                });

                currentA4PalletData.lotes = newLots;
                populateA4SplitLoteSelect('ALL');
                refreshA4QuickPalletFilterSelect();
                renderA4LotCheckboxes();
                showAlert(`Divisão por lote aplicada com sucesso!`, "success");

            } else {
                // Fraciona especificamente o lote selecionado no dropdown
                const targetIdx = currentA4PalletData.lotes.findIndex(l => String(l.id) === String(splitMode));
                if (targetIdx === -1) {
                    showAlert("Lote selecionado não encontrado.", "error");
                    return;
                }

                const targetLot = currentA4PalletData.lotes[targetIdx];
                const finalTotal = totalQtd > 0 ? totalQtd : (parseFloat(targetLot.quantidade) || 0);

                if (finalTotal <= 0) {
                    showAlert("Informe uma quantidade total válida para este lote.", "warning");
                    return;
                }

                const splitLots = [];

                if (perPallet < finalTotal) {
                    const fullCount = Math.floor(finalTotal / perPallet);
                    const remainder = Math.round((finalTotal % perPallet) * 1000) / 1000;
                    const totalSlices = fullCount + (remainder > 0.0001 ? 1 : 0);

                    for (let i = 1; i <= fullCount; i++) {
                        splitLots.push({
                            ...targetLot,
                            id: `${targetLot.id}_split_${i}_${Date.now()}`,
                            quantidade: perPallet,
                            embalagem: totalSlices > 1 ? `${u} ${i}/${totalSlices}` : u
                        });
                    }

                    if (remainder > 0.0001) {
                        splitLots.push({
                            ...targetLot,
                            id: `${targetLot.id}_split_${totalSlices}_${Date.now()}`,
                            quantidade: remainder,
                            embalagem: `${u} ${totalSlices}/${totalSlices} (RESTO)`
                        });
                    }
                } else {
                    splitLots.push({
                        ...targetLot,
                        quantidade: finalTotal,
                        embalagem: targetLot.embalagem || u
                    });
                }

                // Substitui o lote fracionado na lista de lotes mantendo os outros lotes intactos
                currentA4PalletData.lotes.splice(targetIdx, 1, ...splitLots);

                const newSplitIds = splitLots.map(l => l.id);
                populateA4SplitLoteSelect(splitLots[0].id);
                refreshA4QuickPalletFilterSelect();
                renderA4LotCheckboxes(newSplitIds);
                showAlert(`Lote ${targetLot.lote || ''} dividido com sucesso em ${splitLots.length} paletes!`, "success");
            }
        }

        function onA4QuickPalletFilterChange() {
            const select = document.getElementById('a4QuickPalletFilterSelect');
            const headerInput = document.getElementById('a4PalletHeaderInput');
            if (!select || !currentA4PalletData) return;

            const val = select.value;
            const chks = document.querySelectorAll('.a4-lot-chk');

            if (val === 'ALL') {
                chks.forEach(c => c.checked = true);
                if (headerInput) headerInput.value = 'IDENTIFICAÇÃO DE PALETE / ESTOQUE GERAL';
            } else {
                chks.forEach(c => {
                    const lotId = c.value;
                    const lot = currentA4PalletData.lotes.find(l => String(l.id) === String(lotId));
                    c.checked = lot && String(lot.embalagem || 'PALETE').trim() === val;
                });
                if (headerInput) headerInput.value = val;
            }

            onA4LotCheckboxChange();
        }

        function onA4LotCheckboxChange() {
            if (!currentA4PalletData) return;
            const chks = Array.from(document.querySelectorAll('.a4-lot-chk:checked'));
            const select = document.getElementById('a4SplitLoteSelect');
            const totalInput = document.getElementById('a4InputTotalQtd');
            if (!totalInput) return;

            if (chks.length === 1) {
                const checkedId = chks[0].value;
                const lot = currentA4PalletData.lotes.find(l => String(l.id) === String(checkedId));
                if (lot) {
                    if (select) select.value = String(lot.id);
                    totalInput.value = parseFloat(lot.quantidade) || '';
                }
            } else if (chks.length > 1) {
                if (select) select.value = 'ALL';
                const sumQtd = chks.reduce((acc, c) => {
                    const lot = currentA4PalletData.lotes.find(l => String(l.id) === String(c.value));
                    return acc + (lot ? (parseFloat(lot.quantidade) || 0) : 0);
                }, 0);
                totalInput.value = sumQtd > 0 ? sumQtd : '';
            } else {
                totalInput.value = '';
            }

            onA4QuantityInputsChange();
        }

        function closeA4PrintModal() {
            const modal = document.getElementById('a4PrintModal');
            if (modal) modal.classList.add('pointer-events-none', 'opacity-0');
        }

        function renderA4LotCheckboxes(checkedIds) {
            const container = document.getElementById('a4LotCheckboxesContainer');
            if (!container || !currentA4PalletData) return;

            container.innerHTML = '';
            if (currentA4PalletData.lotes.length === 0) {
                container.innerHTML = `<p class="text-xs text-slate-400 font-bold p-2">Nenhum lote ou palete listado para este material.</p>`;
                return;
            }

            currentA4PalletData.lotes.forEach((lot) => {
                const itemDiv = document.createElement('label');
                itemDiv.className = "flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors";
                
                const lotSt = getValidadeStatus(lot.data_validade);
                let badge = `<span class="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800">No Prazo</span>`;
                if (lotSt === 'VENCIDO') badge = `<span class="px-2 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-800">Vencido</span>`;
                else if (lotSt === 'AVENCER') badge = `<span class="px-2 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-800">A Vencer</span>`;

                const palletDisplay = lot.embalagem ? lot.embalagem : (currentA4PalletData ? currentA4PalletData.unidade : 'UN');
                const isChecked = checkedIds ? checkedIds.includes(String(lot.id)) : true;

                itemDiv.innerHTML = `
                    <div class="flex items-center space-x-3">
                        <input type="checkbox" id="a4_lot_chk_${lot.id}" value="${lot.id}" ${isChecked ? 'checked' : ''} onchange="onA4LotCheckboxChange()" class="a4-lot-chk w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer">
                        <div>
                            <span class="font-black text-xs text-slate-900 dark:text-white">Lote: ${lot.lote || 'S/ LOTE'}</span>
                            <span class="text-[11px] font-extrabold text-indigo-600 dark:text-indigo-400 ml-1.5">[${palletDisplay}]</span>
                            <span class="text-[11px] text-slate-500 font-bold ml-1.5">• Qtd: ${Number(lot.quantidade || 0).toLocaleString('pt-BR')} ${currentA4PalletData.unidade || 'UN'}</span>
                        </div>
                    </div>
                    <div class="flex items-center space-x-2">
                        <span class="text-xs font-black text-slate-800 dark:text-slate-200 font-mono">${lot.data_validade ? `Val: ${formatAnoMesDisplay(lot.data_validade)}` : ''}</span>
                        ${lot.data_validade ? badge : ''}
                    </div>
                `;
                container.appendChild(itemDiv);
            });
        }

        function toggleAllA4LotCheckboxes(check) {
            const chks = document.querySelectorAll('.a4-lot-chk');
            chks.forEach(c => c.checked = check);
            onA4LotCheckboxChange();
        }

        function adjustA4Copies(delta) {
            const input = document.getElementById('a4LabelCopiesInput');
            if (!input) return;
            let val = parseInt(input.value, 10) || 1;
            val += delta;
            if (val < 1) val = 1;
            if (val > 100) val = 100;
            input.value = val;
        }

        async function printA4PalletSheet() {
            if (!currentA4PalletData) return;
            const { filial, armazem, produto, lotes } = currentA4PalletData;

            const chks = document.querySelectorAll('.a4-lot-chk:checked');
            const selectedIds = Array.from(chks).map(c => String(c.value));

            if (selectedIds.length === 0) {
                showAlert("Por favor, selecione ao menos um lote/palete para sair na impressão da folha A4.", "warning");
                return;
            }

            const selectedLots = lotes.filter(l => selectedIds.includes(String(l.id)));
            const copiesInput = document.getElementById('a4LabelCopiesInput');
            const copies = copiesInput ? (parseInt(copiesInput.value, 10) || 1) : 1;

            const headerInput = document.getElementById('a4PalletHeaderInput');
            const palletHeader = headerInput ? headerInput.value.trim() : 'IDENTIFICAÇÃO DE PALETE';

            const sbMatch = rawSb1Dataset ? rawSb1Dataset.find(p => String(p.Codigo).trim().toUpperCase() === produto) : null;
            const desc = sbMatch ? (sbMatch['Descr.Espec.'] || produto) : produto;
            const unidade = sbMatch && sbMatch.Unidade ? String(sbMatch.Unidade).trim().toUpperCase() : (currentA4PalletData.unidade || 'UN');
            const endereco = (sbMatch ? (sbMatch.endereco || sbMatch.Endereco) : '') || '';

            let totalSelectedQtd = 0;
            selectedLots.forEach(l => totalSelectedQtd += parseFloat(l.quantidade || 0));

            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(produto)}`;

            const printContainer = document.getElementById('a4PrintContainer');
            if (!printContainer) return;

            const layoutModeRadio = document.querySelector('input[name="a4PrintLayoutMode"]:checked');
            const isIndividualMode = layoutModeRadio && layoutModeRadio.value === 'INDIVIDUAL';

            let fullHtml = '';

            if (isIndividualMode) {
                // 1 FOLHA A4 PARA CADA PALETE / VOLUME SELECIONADO (COM DESTAQUE GIGANTE)
                for (let c = 0; c < copies; c++) {
                    selectedLots.forEach((lot) => {
                        const st = getValidadeStatus(lot.data_validade);
                        let stText = 'NO PRAZO';
                        let stColor = '#059669';
                        if (st === 'VENCIDO') {
                            stText = 'VENCIDO';
                            stColor = '#dc2626';
                        } else if (st === 'AVENCER') {
                            stText = 'A VENCER (60d)';
                            stColor = '#d97706';
                        }

                        fullHtml += `
                            <div class="a4-pallet-page">
                                <div class="a4-pallet-card">
                                    <!-- CABEÇALHO COM LOGO E IDENTIFICAÇÃO DO PALETE -->
                                    <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #000000; padding-bottom: 10px;">
                                        <div>
                                            <h1 style="margin: 0; font-size: 19pt; font-weight: 900; color: #002f6c; text-transform: uppercase; letter-spacing: 0.5px;">AMAZON AÇO • CONTROLE DE ESTOQUE</h1>
                                            <div style="margin-top: 4px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                                <span style="font-size: 13pt; font-weight: 900; color: #1e293b;">FICHA DE IDENTIFICAÇÃO DE PALETE</span>
                                                <span style="font-size: 13pt; font-weight: 900; color: #ffffff; background: #002f6c; padding: 2px 10px; border-radius: 6px; -webkit-print-color-adjust: exact; print-color-adjust: exact;">${lot.embalagem || palletHeader || 'PALETE'}</span>
                                            </div>
                                            <p style="margin: 5px 0 0 0; font-size: 11.5pt; font-weight: 900; color: #000000;">FILIAL: ${filial} &nbsp;|&nbsp; ARMAZÉM: ${armazem} ${endereco ? `&nbsp;|&nbsp; 📍 ENDEREÇO: <b style="color: #002f6c;">${endereco}</b>` : ''}</p>
                                        </div>
                                        <div style="text-align: right; flex-shrink: 0;">
                                            <img src="${qrUrl}" alt="QR Code" style="width: 110px; height: 110px; border: 2px solid #000000; padding: 2px; background: #ffffff;" />
                                        </div>
                                    </div>

                                    <!-- CÓDIGO DO MATERIAL EM DESTAQUE MÁXIMO -->
                                    <div style="text-align: center; background: #002f6c; color: #ffffff; padding: 14px 8px; margin-top: 14px; border-radius: 8px; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                                        <span style="font-family: monospace, Courier, sans-serif; font-size: 44pt; font-weight: 900; letter-spacing: 3px; line-height: 1;">${produto}</span>
                                    </div>

                                    <!-- DESCRIÇÃO COMPLETA -->
                                    <div style="margin-top: 14px; border: 2.5px solid #000000; padding: 12px 16px; border-radius: 8px; background: #f8fafc; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                                        <span style="font-size: 10pt; font-weight: 900; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">Descrição do Material:</span>
                                        <h2 style="margin: 4px 0 0 0; font-size: 18pt; font-weight: 900; color: #000000; text-transform: uppercase; line-height: 1.25;">${desc}</h2>
                                    </div>

                                    <!-- CARD DE QUANTIDADE GIGANTE DESTE PALETE -->
                                    <div style="margin-top: 16px; border: 3.5px solid #002f6c; border-radius: 12px; padding: 18px 12px; text-align: center; background: #f0f7ff; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                                        <span style="font-size: 13pt; font-weight: 900; color: #002f6c; text-transform: uppercase; letter-spacing: 1px;">QUANTIDADE NESTE PALETE / VOLUME:</span>
                                        <div style="font-size: 46pt; font-weight: 900; color: #002f6c; line-height: 1.05; margin: 8px 0;">
                                            ${Number(lot.quantidade || 0).toLocaleString('pt-BR')} <span style="font-size: 26pt;">${unidade}</span>
                                        </div>
                                        <div style="display: flex; justify-content: center; align-items: center; gap: 16px; font-size: 13pt; font-weight: 900; color: #000000; margin-top: 8px; flex-wrap: wrap;">
                                            <span>LOTE: <b>${lot.lote || 'S/ LOTE'}</b></span>
                                            ${lot.data_fabricacao ? `<span>• FAB: <b>${formatAnoMesDisplay(lot.data_fabricacao)}</b></span>` : ''}
                                            ${lot.data_validade ? `<span>• VAL: <b>${formatAnoMesDisplay(lot.data_validade)}</b></span>` : ''}
                                            ${lot.data_validade ? `<span style="color: ${stColor};">• ${stText}</span>` : ''}
                                        </div>
                                    </div>

                                    <!-- RODAPÉ DA FOLHA -->
                                    <div style="margin-top: 24px; border-top: 2px dashed #64748b; padding-top: 10px; display: flex; justify-content: space-between; font-size: 9.5pt; font-weight: 700; color: #475569;">
                                        <span>Emitido por: ${currentUser ? currentUser.nome : 'ALMOXARIFADO'}</span>
                                        <span>Data/Hora: ${new Date().toLocaleString('pt-BR')}</span>
                                        <span>Portal de Estoques Amazon Aço</span>
                                    </div>
                                </div>
                            </div>
                        `;
                    });
                }
            } else {
                // FOLHA A4 CONSOLIDADA (TABELA COM TODOS OS PALETES/LOTES)
                for (let c = 0; c < copies; c++) {
                    let rowsHtml = '';
                    selectedLots.forEach(l => {
                        const st = getValidadeStatus(l.data_validade);
                        let stText = 'NO PRAZO';
                        let stColor = '#059669';
                        if (st === 'VENCIDO') {
                            stText = 'VENCIDO';
                            stColor = '#dc2626';
                        } else if (st === 'AVENCER') {
                            stText = 'A VENCER (60d)';
                            stColor = '#d97706';
                        }

                        rowsHtml += `
                            <tr>
                                <td style="font-family: monospace, Courier, sans-serif; font-size: 12pt; font-weight: 900; word-break: break-word;">${l.lote || 'S/ LOTE'}</td>
                                <td style="font-size: 11pt; font-weight: 900; color: #002f6c; text-transform: uppercase;">${l.embalagem || 'PALETE'}</td>
                                <td style="text-align: right; font-size: 13pt; font-weight: 900; white-space: nowrap;">${Number(l.quantidade || 0).toLocaleString('pt-BR')} ${unidade}</td>
                                <td style="text-align: center; font-size: 11pt; font-weight: 800; white-space: nowrap;">${formatAnoMesDisplay(l.data_fabricacao)}</td>
                                <td style="text-align: center; font-size: 13pt; font-weight: 900; white-space: nowrap;">${formatAnoMesDisplay(l.data_validade)}</td>
                                <td style="text-align: center; font-size: 10pt; font-weight: 900; color: ${stColor};">${l.data_validade ? stText : '-'}</td>
                                <td style="font-size: 10pt; font-weight: 600; word-break: break-word;">${l.observacao || '-'}</td>
                            </tr>
                        `;
                    });

                    fullHtml += `
                        <div class="a4-pallet-page">
                            <div class="a4-pallet-card">
                                <!-- CABEÇALHO COM LOGO E IDENTIFICAÇÃO DO PALETE -->
                                <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #000000; padding-bottom: 10px;">
                                    <div>
                                        <h1 style="margin: 0; font-size: 19pt; font-weight: 900; color: #002f6c; text-transform: uppercase; letter-spacing: 0.5px;">AMAZON AÇO • CONTROLE DE ESTOQUE</h1>
                                        <div style="margin-top: 4px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                            <span style="font-size: 13pt; font-weight: 900; color: #1e293b;">FICHA DE PALETE / PRATELEIRA</span>
                                            ${palletHeader ? `<span style="font-size: 12pt; font-weight: 900; color: #ffffff; background: #002f6c; padding: 2px 8px; border-radius: 4px; -webkit-print-color-adjust: exact; print-color-adjust: exact;">${palletHeader}</span>` : ''}
                                        </div>
                                        <p style="margin: 5px 0 0 0; font-size: 11.5pt; font-weight: 900; color: #000000;">FILIAL: ${filial} &nbsp;|&nbsp; ARMAZÉM: ${armazem} ${endereco ? `&nbsp;|&nbsp; 📍 ENDEREÇO: <b style="color: #002f6c;">${endereco}</b>` : ''}</p>
                                    </div>
                                    <div style="text-align: right; flex-shrink: 0;">
                                        <img src="${qrUrl}" alt="QR Code" style="width: 105px; height: 105px; border: 2px solid #000000; padding: 2px; background: #ffffff;" />
                                    </div>
                                </div>

                                <!-- CÓDIGO DO MATERIAL EM DESTAQUE MÁXIMO -->
                                <div style="text-align: center; background: #002f6c; color: #ffffff; padding: 12px 8px; margin-top: 12px; border-radius: 8px; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                                    <span style="font-family: monospace, Courier, sans-serif; font-size: 42pt; font-weight: 900; letter-spacing: 3px; line-height: 1;">${produto}</span>
                                </div>

                                <!-- DESCRIÇÃO COMPLETA -->
                                <div style="margin-top: 12px; border: 2.5px solid #000000; padding: 10px 14px; border-radius: 8px; background: #f8fafc; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                                    <span style="font-size: 9.5pt; font-weight: 900; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">Descrição do Material:</span>
                                    <h2 style="margin: 3px 0 0 0; font-size: 17pt; font-weight: 900; color: #000000; text-transform: uppercase; line-height: 1.25;">${desc}</h2>
                                </div>

                                <!-- TABELA DE LOTES E PALETES -->
                                <div style="margin-top: 14px; width: 100%;">
                                    <h3 style="margin: 0 0 6px 0; font-size: 11.5pt; font-weight: 900; text-transform: uppercase; color: #000000;">Lotes e Paletes Presentes nesta Folha:</h3>
                                    <table class="a4-table" style="width: 100%; table-layout: fixed; border-collapse: collapse; box-sizing: border-box;">
                                        <thead>
                                            <tr>
                                                <th style="width: 18%;">Lote</th>
                                                <th style="width: 18%;">Palete/Vol</th>
                                                <th style="width: 18%; text-align: right;">Quantidade</th>
                                                <th style="width: 13%; text-align: center;">Fabricação</th>
                                                <th style="width: 15%; text-align: center;">Validade</th>
                                                <th style="width: 11%; text-align: center;">Status</th>
                                                <th style="width: 7%;">Obs.</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${rowsHtml}
                                        </tbody>
                                        <tfoot>
                                            <tr>
                                                <td colspan="2" style="text-align: right; font-weight: 900; font-size: 11pt; text-transform: uppercase;">TOTAL:</td>
                                                <td style="text-align: right; font-weight: 900; font-size: 14pt; color: #002f6c; -webkit-print-color-adjust: exact; print-color-adjust: exact; white-space: nowrap;">${totalSelectedQtd.toLocaleString('pt-BR')} ${unidade}</td>
                                                <td colspan="4" style="text-align: right; font-size: 11pt; font-weight: 900; color: #334155;">${selectedLots.length} item(ns) selecionado(s)</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>

                                <!-- RODAPÉ DA FOLHA -->
                                <div style="margin-top: 16px; border-top: 2px dashed #64748b; padding-top: 8px; display: flex; justify-content: space-between; font-size: 9pt; font-weight: 700; color: #475569;">
                                    <span>Emitido por: ${currentUser ? currentUser.nome : 'ALMOXARIFADO'}</span>
                                    <span>Data/Hora: ${new Date().toLocaleString('pt-BR')}</span>
                                    <span>Portal de Estoques Amazon Aço</span>
                                </div>
                            </div>
                        </div>
                    `;
                }
            }

            printContainer.innerHTML = fullHtml;

            // Aguarda o download do QR code antes de abrir a impressão
            const imgs = Array.from(printContainer.querySelectorAll('img'));
            await Promise.all(imgs.map(img => {
                if (img.complete) return Promise.resolve();
                return new Promise(resolve => {
                    img.onload = resolve;
                    img.onerror = resolve;
                    setTimeout(resolve, 1500);
                });
            }));
            let pageStyle = document.getElementById('dynamicPrintPageStyle');
            if (!pageStyle) {
                pageStyle = document.createElement('style');
                pageStyle.id = 'dynamicPrintPageStyle';
                document.head.appendChild(pageStyle);
            }
            pageStyle.innerHTML = `@page { size: A4 portrait !important; margin: 8mm !important; }`;

            document.body.classList.remove('printing-argox');
            document.body.classList.add('printing-a4');
            window.print();

            setTimeout(() => {
                document.body.classList.remove('printing-a4');
            }, 1000);
        }

        // --- GESTÃO DE LOTES, PALETES E VALIDADE (MODAL NOVO / EDIÇÃO) ---

        let modalPalletRows = [];
        let deletedPalletDbIds = [];
        let activeValidadeCalcRowId = null;

        function getProductUnit(codigo) {
            if (!codigo) return 'UN';
            const c = String(codigo).trim().toUpperCase();
            const match = rawSb1Dataset ? rawSb1Dataset.find(p => String(p.Codigo || p.codigo).trim().toUpperCase() === c) : null;
            return (match && (match.Unidade || match.unidade)) ? String(match.Unidade || match.unidade).trim().toUpperCase() : 'UN';
        }

        function parseSmartMathExpression(exprStr) {
            if (exprStr === null || exprStr === undefined) return null;
            let s = String(exprStr).trim();
            if (!s) return null;

            s = s.replace(/,/g, '.');

            const openCount = (s.match(/\(/g) || []).length;
            const closeCount = (s.match(/\)/g) || []).length;
            if (openCount > closeCount) {
                s += ')'.repeat(openCount - closeCount);
            }

            s = s.replace(/(\d+(\.\d+)?)\s*\(/g, '$1*(');
            s = s.replace(/\)\s*(\d+(\.\d+)?)/g, ')*$1');

            if (!/^[0-9+\-*/.()\s]+$/.test(s)) return null;

            try {
                const val = Function(`'use strict'; return (${s});`)();
                if (typeof val === 'number' && !isNaN(val) && isFinite(val)) {
                    return val;
                }
            } catch(e) {
                return null;
            }
            return null;
        }

        function toggleValidadeCalculator(show = null) {
            const keypad = document.getElementById('validadeCalculatorKeypad');
            const label = document.getElementById('labelToggleCalcValidade');
            if (!keypad) return;

            const isHidden = keypad.classList.contains('hidden');
            const shouldShow = (show !== null) ? show : isHidden;

            if (shouldShow) {
                keypad.classList.remove('hidden');
                if (label) label.innerText = 'Fechar Calculadora';
                if (!activeValidadeCalcRowId && modalPalletRows.length > 0) {
                    setActiveValidadeCalcTarget(modalPalletRows[0].id);
                }
            } else {
                keypad.classList.add('hidden');
                if (label) label.innerText = 'Abrir Calculadora';
            }
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }

        function setActiveValidadeCalcTarget(rowId) {
            activeValidadeCalcRowId = rowId;
            const label = document.getElementById('validadeCalcTargetLabel');
            const rowIdx = modalPalletRows.findIndex(r => String(r.id) === String(rowId));
            if (label) {
                label.innerText = rowIdx !== -1 ? `Linha #${rowIdx + 1} (${modalPalletRows[rowIdx].nome || 'Palete'})` : 'Toque no campo para digitar';
            }

            document.querySelectorAll('[id^="palletCard_"]').forEach(card => {
                card.classList.remove('border-amber-500', 'ring-2', 'ring-amber-400/30');
                card.classList.add('border-slate-200');
            });

            if (rowId) {
                const activeCard = document.getElementById(`palletCard_${rowId}`);
                if (activeCard) {
                    activeCard.classList.remove('border-slate-200');
                    activeCard.classList.add('border-amber-500', 'ring-2', 'ring-amber-400/30');
                }
            }
        }

        function calcKeypadPressValidade(char) {
            if (!activeValidadeCalcRowId) {
                if (modalPalletRows.length > 0) {
                    setActiveValidadeCalcTarget(modalPalletRows[0].id);
                } else {
                    return;
                }
            }

            const inp = document.getElementById(`valPalletQtdInput_${activeValidadeCalcRowId}`);
            if (!inp) return;

            if (char === 'C') {
                inp.value = '';
                onModalPalletRowChange(activeValidadeCalcRowId, 'qtd', '');
            } else if (char === 'BACKSPACE') {
                inp.value = inp.value.slice(0, -1);
                const calcVal = parseSmartMathExpression(inp.value);
                onModalPalletRowChange(activeValidadeCalcRowId, 'qtd', calcVal !== null ? calcVal : (parseFloat(inp.value) || 0));
            } else if (char === '=') {
                const rawVal = inp.value.trim();
                if (rawVal) {
                    const val = parseSmartMathExpression(rawVal);
                    if (val !== null && !isNaN(val) && val >= 0) {
                        inp.value = String(val);
                        onModalPalletRowChange(activeValidadeCalcRowId, 'qtd', val);
                        toggleValidadeCalculator(false);
                    } else {
                        showAlert("Expressão de cálculo inválida. Corrija o valor digitado.", "warning");
                    }
                }
                return;
            } else {
                inp.value += char;
                const calcVal = parseSmartMathExpression(inp.value);
                onModalPalletRowChange(activeValidadeCalcRowId, 'qtd', calcVal !== null ? calcVal : (parseFloat(inp.value) || 0));
            }
        }

        function toggleMultiPalletSplit(show = null) {
            const box = document.getElementById('multiPalletSplitBox');
            const lbl = document.getElementById('lblToggleMultiPallet');
            if (!box) return;

            const isHidden = box.classList.contains('hidden');
            const shouldShow = (show !== null) ? show : isHidden;

            if (shouldShow) {
                box.classList.remove('hidden');
                if (lbl) lbl.innerText = 'Fechar Divisão Rápida';
                const totalInp = document.getElementById('valAutoSplitTotalQtd');
                if (totalInp && (!totalInp.value || totalInp.value === '0')) {
                    let curSum = 0;
                    modalPalletRows.forEach(r => curSum += (parseFloat(r.qtd) || 0));
                    totalInp.value = curSum > 0 ? curSum : '';
                }
            } else {
                box.classList.add('hidden');
                if (lbl) lbl.innerText = '⚡ Divisão Rápida';
            }
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }

        function addModalPalletRow(initialData = null) {
            const code = document.getElementById('valInputCodigo') ? document.getElementById('valInputCodigo').value : '';
            const unit = getProductUnit(code);
            const defaultName = unit;

            const newRow = initialData ? { ...initialData } : {
                id: 'row_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
                isNew: true,
                dbId: null,
                nome: defaultName,
                qtd: ''
            };
            modalPalletRows.push(newRow);
            renderModalPalletRows();
            return newRow;
        }

        function addMultiPalletRow(initialData = null) {
            return addModalPalletRow(initialData);
        }

        function removeModalPalletRow(rowId) {
            const rowIdx = modalPalletRows.findIndex(r => String(r.id) === String(rowId));
            if (rowIdx === -1) return;

            const row = modalPalletRows[rowIdx];
            if (row.dbId) {
                deletedPalletDbIds.push(row.dbId);
            }

            modalPalletRows.splice(rowIdx, 1);

            if (modalPalletRows.length === 0) {
                const code = document.getElementById('valInputCodigo') ? document.getElementById('valInputCodigo').value : '';
                const unit = getProductUnit(code);
                modalPalletRows.push({
                    id: 'row_' + Date.now(),
                    isNew: true,
                    dbId: null,
                    nome: unit,
                    qtd: ''
                });
            }

            renderModalPalletRows();
        }

        function onModalPalletRowChange(rowId, field, val) {
            const row = modalPalletRows.find(r => String(r.id) === String(rowId));
            if (row) {
                row[field] = val;
                updateModalPalletTotalSum();
                updateModalSaldoComparison();
            }
        }

        function onModalPalletQtdInputChange(rowId, rawVal) {
            const calcVal = parseSmartMathExpression(rawVal);
            const finalVal = calcVal !== null ? calcVal : (parseFloat(rawVal) || 0);
            onModalPalletRowChange(rowId, 'qtd', rawVal.trim() === '' ? '' : finalVal);
        }

        function renderModalPalletRows() {
            const container = document.getElementById('multiPalletRowsContainer');
            if (!container) return;
            container.innerHTML = '';

            const code = document.getElementById('valInputCodigo') ? document.getElementById('valInputCodigo').value : '';
            const unit = getProductUnit(code);

            if (modalPalletRows.length === 0) {
                modalPalletRows.push({
                    id: 'row_init',
                    isNew: true,
                    dbId: null,
                    nome: unit,
                    qtd: ''
                });
            }

            modalPalletRows.forEach((row, idx) => {
                const isTarget = (activeValidadeCalcRowId === row.id);
                const div = document.createElement('div');
                div.id = `palletCard_${row.id}`;
                div.className = `flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded-xl border ${isTarget ? 'border-amber-500 ring-2 ring-amber-400/30' : 'border-slate-200 dark:border-slate-700'} shadow-2xs transition-all`;
                
                const rowDisplayName = row.nome || unit;

                div.innerHTML = `
                    <span class="w-6 text-center text-xs font-black text-indigo-600 dark:text-indigo-400">#${idx+1}</span>
                    <input type="text" value="${rowDisplayName}" oninput="onModalPalletRowChange('${row.id}', 'nome', this.value.toUpperCase())" placeholder="Ex: ${unit}" class="w-2/5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 text-xs font-black text-slate-800 dark:text-white uppercase focus:ring-1 focus:ring-amber-500">
                    <div class="relative w-2/5 flex items-center">
                        <input type="text" inputmode="decimal" id="valPalletQtdInput_${row.id}" value="${row.qtd !== '' && row.qtd !== undefined ? row.qtd : ''}" onfocus="setActiveValidadeCalcTarget('${row.id}')" onclick="setActiveValidadeCalcTarget('${row.id}')" oninput="onModalPalletQtdInputChange('${row.id}', this.value)" placeholder="Qtd (${unit})" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 pr-7 text-xs font-black text-indigo-700 dark:text-indigo-300 focus:ring-1 focus:ring-amber-500">
                        <button type="button" onclick="setActiveValidadeCalcTarget('${row.id}'); toggleValidadeCalculator(true);" class="absolute right-1 text-slate-400 hover:text-amber-600 p-1 cursor-pointer" title="Abrir calculadora para esta linha">
                            <i data-lucide="calculator" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                    <button type="button" onclick="removeModalPalletRow('${row.id}')" class="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer ml-auto transition-colors" title="Apagar esta linha">
                        <i data-lucide="trash-2" class="w-4 h-4 text-rose-500"></i>
                    </button>
                `;
                container.appendChild(div);
            });

            updateModalPalletTotalSum();
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }

        function updateModalPalletTotalSum() {
            let sum = 0;
            modalPalletRows.forEach(r => sum += (parseFloat(r.qtd) || 0));
            const elSum = document.getElementById('multiPalletTotalSum');
            if (elSum) elSum.innerText = sum.toLocaleString('pt-BR');
        }

        function autoSplitPalletsByCapacity() {
            const inputTotal = document.getElementById('valAutoSplitTotalQtd');
            const inputCap = document.getElementById('valAutoSplitQtdPerPallet');

            const totalQtd = inputTotal ? parseFloat(inputTotal.value || 0) : 0;
            const cap = inputCap ? parseFloat(inputCap.value || 0) : 0;

            if (!totalQtd || totalQtd <= 0) {
                showAlert("Informe a Quantidade Total a Fracionar.", "warning");
                return;
            }
            if (!cap || cap <= 0) {
                showAlert("Informe a Quantidade por Palete (Capacidade). Ex: 1000", "warning");
                return;
            }

            const fullCount = Math.floor(totalQtd / cap);
            const remainder = Math.round((totalQtd % cap) * 1000) / 1000;
            const totalPallets = fullCount + (remainder > 0.0001 ? 1 : 0);

            if (totalPallets <= 0) {
                showAlert("Valores inválidos para divisão.", "warning");
                return;
            }

            // Marca linhas antigas do banco para exclusão se foram substituídas
            modalPalletRows.forEach(r => {
                if (r.dbId) deletedPalletDbIds.push(r.dbId);
            });

            const code = document.getElementById('valInputCodigo') ? document.getElementById('valInputCodigo').value : '';
            const unit = getProductUnit(code);

            modalPalletRows = [];
            for (let i = 1; i <= fullCount; i++) {
                modalPalletRows.push({
                    id: 'split_' + Date.now() + '_' + i,
                    isNew: true,
                    dbId: null,
                    nome: `${unit} ${i}/${totalPallets}`,
                    qtd: cap
                });
            }

            if (remainder > 0.0001) {
                modalPalletRows.push({
                    id: 'split_' + Date.now() + '_' + totalPallets,
                    isNew: true,
                    dbId: null,
                    nome: `${unit} ${totalPallets}/${totalPallets} (RESTO)`,
                    qtd: remainder
                });
            }

            renderModalPalletRows();
            showAlert(`Divisão calculada com sucesso: ${totalPallets} paletes gerados!`, "success");
        }

        function scanBarcodeForValidade() {
            openCameraScanner(async (decodedText) => {
                if (!decodedText) return;
                let scanned = String(decodedText).trim();
                let targetFilial = null;
                let targetArmazem = null;
                let targetLote = null;

                // Se for QR Code estruturado de Palete (AMAZON_ACO|filial|armazem|produto|lote)
                if (scanned.startsWith('AMAZON_ACO|')) {
                    const parts = scanned.split('|');
                    if (parts.length >= 4) {
                        targetFilial = parts[1];
                        targetArmazem = parts[2];
                        scanned = parts[3].trim();
                        if (parts.length >= 5) targetLote = parts[4];
                    }
                }

                const cleanInput = scanned.toUpperCase();
                
                // Busca inteligente por código interno, código do fornecedor ou código de barras
                const found = await findProductByAnyCode(cleanInput);
                const finalCode = found ? String(found.product.Codigo || found.product.codigo).trim().toUpperCase() : cleanInput;

                // 1. Verifica se há lotes para este material
                const matchingLots = (rawValidadeDataset || []).filter(v => String(v.produto).trim().toUpperCase() === finalCode);

                if (matchingLots.length > 0) {
                    const first = matchingLots[0];
                    const fil = targetFilial || first.filial;
                    const arm = targetArmazem || first.armazem;
                    let msg = `Material localizado: ${finalCode}`;
                    if (found && found.matchType === 'CODIGO_FORNECEDOR') {
                        msg += ` (via Cód. Fornecedor ${cleanInput})`;
                    } else if (found && found.matchType === 'CODIGO_BARRAS') {
                        msg += ` (via Cód. Barras ${cleanInput})`;
                    }
                    showAlert(`${msg}. Abrindo lista de lotes...`, "success");
                    openProductLotsModal(fil, arm, finalCode);
                } else if (found) {
                    const arm = targetArmazem || (rawKnownWarehouses.length > 0 ? rawKnownWarehouses[0] : '01');
                    let msg = `Material localizado: ${finalCode}`;
                    if (found.matchType === 'CODIGO_FORNECEDOR') msg += ` (via Cód. Fornecedor ${cleanInput})`;
                    else if (found.matchType === 'CODIGO_BARRAS') msg += ` (via Cód. Barras ${cleanInput})`;
                    showAlert(`${msg}. Abrindo novo cadastro de lote...`, "info");
                    openNewValidadeModal(finalCode, arm);
                } else {
                    // Código desconhecido: pergunta se deseja vincular a um produto existente
                    const wantLink = confirm(
                        `Código bipado: "${cleanInput}"\n\n` +
                        `Este código não foi localizado no cadastro como Código Interno, Fornecedor ou Código de Barras.\n\n` +
                        `Deseja abrir a Central de Códigos para vincular este código a um material agora?`
                    );
                    if (wantLink) {
                        openCodigosManagerModal(cleanInput);
                    }
                }
            }, { title: "Bipar Ficha A4, Código de Barras ou Fornecedor" });
        }

        function scanBarcodeIntoModalField() {
            openCameraScanner(async (decodedText) => {
                if (!decodedText) return;
                let scanned = String(decodedText).trim();
                if (scanned.startsWith('AMAZON_ACO|')) {
                    const parts = scanned.split('|');
                    if (parts.length >= 4) {
                        scanned = parts[3].trim();
                    }
                }
                const cleanInput = scanned.toUpperCase();
                const found = await findProductByAnyCode(cleanInput);
                const finalCode = found ? String(found.product.Codigo || found.product.codigo).trim().toUpperCase() : cleanInput;

                const inp = document.getElementById('valInputCodigo');
                if (inp) {
                    inp.value = finalCode;
                    onValidadeCodeOrLoteChange();
                }

                if (found && found.matchType === 'CODIGO_FORNECEDOR') {
                    showAlert(`Código de Fornecedor "${cleanInput}" identificado ➔ Material ${finalCode}`, "success");
                } else if (found && found.matchType === 'CODIGO_BARRAS') {
                    showAlert(`Código de Barras "${cleanInput}" identificado ➔ Material ${finalCode}`, "success");
                } else {
                    showAlert(`Código ${finalCode} inserido com sucesso!`, "success");
                }
            }, { title: "Bipar Código do Material (Interno / Fornecedor / Barras)" });
        }

        function populateModalFilialSelect(chosenFilial = null) {
            const sel = document.getElementById('valInputFilial');
            if (!sel) return;
            const isGlobal = isGlobalFilial(currentUser);
            const userAssigned = getTargetFilialForSector();

            const filials = [...new Set(rawValidadeDataset.map(v => v.filial))].sort();
            const allAvailable = currentSector === 'INDUSTRIA' ? ['01', '02', '03', '04', '05', '06'] : getCachedFiliaisList().filter(f => f.num_filial !== '00').map(f => String(f.num_filial).padStart(2, '0'));
            const merged = [...new Set([...allAvailable, ...filials])].filter(f => f && f !== '00' && f !== 'ALL').sort();

            let defaultFilial = chosenFilial;
            if (!defaultFilial) {
                const filterFil = document.getElementById('valFilterFilial') ? document.getElementById('valFilterFilial').value : 'ALL';
                if (filterFil && filterFil !== 'ALL' && filterFil !== '00') {
                    defaultFilial = filterFil;
                } else if (!isGlobal && userAssigned && userAssigned !== '00') {
                    defaultFilial = userAssigned;
                } else {
                    defaultFilial = '01';
                }
            }
            defaultFilial = String(defaultFilial).padStart(2, '0');

            if (isGlobal) {
                sel.disabled = false;
                sel.className = "w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer";
                let html = '';
                merged.forEach(f => {
                    const name = getFilialDisplayName(f, currentSector === 'INDUSTRIA' ? 'industria' : 'comercio');
                    html += `<option value="${f}" ${f === defaultFilial ? 'selected' : ''}>${name}</option>`;
                });
                sel.innerHTML = html;
                sel.value = defaultFilial;
            } else {
                sel.disabled = true;
                sel.className = "w-full bg-slate-100 border border-slate-200 rounded-xl py-2.5 px-3 text-xs font-bold text-slate-600 cursor-not-allowed opacity-80";
                const name = getFilialDisplayName(userAssigned, currentSector === 'INDUSTRIA' ? 'industria' : 'comercio');
                sel.innerHTML = `<option value="${userAssigned}" selected>${name}</option>`;
                sel.value = userAssigned;
            }
        }

        function updateModalWarehousesForSelectedFilial() {
            const selFilial = document.getElementById('valInputFilial');
            const targetFil = selFilial ? selFilial.value : '01';
            const selArm = document.getElementById('valInputArmazem');
            if (!selArm) return;

            const saldoArmazens = rawSaldoDataset
                .filter(s => isFilialMatch(s.filial, targetFil))
                .map(s => String(s.armazem || '').trim().padStart(2, '0'))
                .filter(Boolean);

            const valArmazens = (rawValidadeDataset || [])
                .filter(v => isFilialMatch(v.filial, targetFil))
                .map(v => String(v.armazem || '').trim().padStart(2, '0'))
                .filter(Boolean);

            let knownArms = [...new Set([...saldoArmazens, ...valArmazens])]
                .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

            if (knownArms.length === 0) knownArms = ['01', '24', '50'];

            const curArm = selArm.value;
            let html = '';
            knownArms.forEach(a => {
                html += `<option value="${a}">Armazém ${a}</option>`;
            });
            selArm.innerHTML = html;
            if (curArm && knownArms.includes(curArm)) {
                selArm.value = curArm;
            } else if (knownArms.length > 0) {
                selArm.value = knownArms[0];
            }
        }

        function onValidadeFilialChange() {
            updateModalWarehousesForSelectedFilial();
            onValidadeCodeOrLoteChange();
        }

        function populateImportFilialSelect(chosenFilial = null) {
            const sel = document.getElementById('importValidadeFilial');
            if (!sel) return;
            const isGlobal = isGlobalFilial(currentUser);
            const userAssigned = getTargetFilialForSector();

            const filials = [...new Set(rawValidadeDataset.map(v => v.filial))].sort();
            const allAvailable = currentSector === 'INDUSTRIA' ? ['01', '02', '03', '04', '05', '06'] : getCachedFiliaisList().filter(f => f.num_filial !== '00').map(f => String(f.num_filial).padStart(2, '0'));
            const merged = [...new Set([...allAvailable, ...filials])].filter(f => f && f !== '00' && f !== 'ALL').sort();

            let defaultFilial = chosenFilial;
            if (!defaultFilial) {
                const filterFil = document.getElementById('valFilterFilial') ? document.getElementById('valFilterFilial').value : 'ALL';
                if (filterFil && filterFil !== 'ALL' && filterFil !== '00') {
                    defaultFilial = filterFil;
                } else if (!isGlobal && userAssigned && userAssigned !== '00') {
                    defaultFilial = userAssigned;
                } else {
                    defaultFilial = '01';
                }
            }
            defaultFilial = String(defaultFilial).padStart(2, '0');

            if (isGlobal) {
                sel.disabled = false;
                sel.className = "w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 cursor-pointer";
                let html = '';
                merged.forEach(f => {
                    const name = getFilialDisplayName(f, currentSector === 'INDUSTRIA' ? 'industria' : 'comercio');
                    html += `<option value="${f}" ${f === defaultFilial ? 'selected' : ''}>${name}</option>`;
                });
                sel.innerHTML = html;
                sel.value = defaultFilial;
            } else {
                sel.disabled = true;
                sel.className = "w-full bg-slate-100 border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-600 cursor-not-allowed opacity-80";
                const name = getFilialDisplayName(userAssigned, currentSector === 'INDUSTRIA' ? 'industria' : 'comercio');
                sel.innerHTML = `<option value="${userAssigned}" selected>${name}</option>`;
                sel.value = userAssigned;
            }
            updateImportWarehousesForFilial();
        }

        function updateImportWarehousesForFilial() {
            const selFil = document.getElementById('importValidadeFilial');
            const targetFil = selFil ? selFil.value : '01';
            const selArm = document.getElementById('importDefaultArmazem');
            if (!selArm) return;

            const saldoArmazens = rawSaldoDataset
                .filter(s => isFilialMatch(s.filial, targetFil))
                .map(s => String(s.armazem || '').trim().padStart(2, '0'))
                .filter(Boolean);

            const valArmazens = (rawValidadeDataset || [])
                .filter(v => isFilialMatch(v.filial, targetFil))
                .map(v => String(v.armazem || '').trim().padStart(2, '0'))
                .filter(Boolean);

            let knownArms = [...new Set([...saldoArmazens, ...valArmazens])]
                .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

            if (knownArms.length === 0) knownArms = ['01', '24', '50'];

            const curArm = selArm.value;
            let html = '';
            knownArms.forEach(a => {
                html += `<option value="${a}">Armazém ${a}</option>`;
            });
            selArm.innerHTML = html;
            if (curArm && knownArms.includes(curArm)) {
                selArm.value = curArm;
            } else if (knownArms.includes('24')) {
                selArm.value = '24';
            } else if (knownArms.length > 0) {
                selArm.value = knownArms[0];
            }
        }

        function openNewValidadeModal(codigo = '', armazem = '01', filial = null) {
            const modal = document.getElementById('newValidadeModal');
            const inpCodigo = document.getElementById('valInputCodigo');
            const title = document.getElementById('newValidadeModalTitle');

            if (title) title.innerText = "Lançamento de Novo Lote";

            document.getElementById('valEditId').value = '';
            if (inpCodigo) inpCodigo.value = codigo || '';
            
            // Popula seletor de filial e armazéns da filial escolhida
            populateModalFilialSelect(filial);
            updateModalWarehousesForSelectedFilial();
            if (armazem) document.getElementById('valInputArmazem').value = armazem;

            document.getElementById('valInputLote').value = '';
            document.getElementById('valInputFabricacao').value = '';
            document.getElementById('valInputValidade').value = '';
            document.getElementById('valInputObservacao').value = '';

            // Preenche campos de código externo
            const cleanCod = String(codigo || '').trim().toUpperCase();
            const fornRecord = cleanCod ? fornecedorByNossoMap[cleanCod] : null;
            const fornInp = document.getElementById('valInputCodFornecedor');
            const barInp = document.getElementById('valInputCodBarras');
            if (fornInp) fornInp.value = fornRecord ? (fornRecord.codigo_fornecedor || '') : '';
            if (barInp) {
                const pInfo = cleanCod ? rawSb1Dataset.find(p => String(p.Codigo || p.codigo).trim().toUpperCase() === cleanCod) : null;
                barInp.value = (fornRecord && fornRecord.codigo_barras) ? fornRecord.codigo_barras : (pInfo ? pInfo.codigo_barras || '' : '');
            }

            const unit = getProductUnit(codigo);
            modalPalletRows = [{
                id: 'row_' + Date.now(),
                isNew: true,
                dbId: null,
                nome: unit,
                qtd: ''
            }];
            deletedPalletDbIds = [];

            populateProductsDatalist();
            onValidadeCodeInput();
            updateModalSaldoComparison();
            renderModalPalletRows();
            toggleValidadeCalculator(false);
            if (modal) modal.classList.remove('pointer-events-none', 'opacity-0');
        }

        function populateProductsDatalist() {
            const datalist = document.getElementById('valProductsDatalist');
            if (datalist && rawSb1Dataset) {
                let html = '';
                const sorted = [...rawSb1Dataset].sort((a,b) => String(a.Codigo || a.codigo).localeCompare(String(b.Codigo || b.codigo), undefined, {numeric:true}));
                sorted.forEach(p => {
                    const cod = String(p.Codigo || p.codigo || '').trim().toUpperCase();
                    const desc = p['Descr.Espec.'] || p.descricao || '-';
                    html += `<option value="${cod}">${cod} - ${desc}</option>`;

                    const fornInfo = fornecedorByNossoMap[cod];
                    if (fornInfo && fornInfo.codigo_fornecedor) {
                        html += `<option value="${fornInfo.codigo_fornecedor}">[FORNECEDOR] ${fornInfo.codigo_fornecedor} ➔ ${cod} (${desc})</option>`;
                    }
                    const barCode = (fornInfo && fornInfo.codigo_barras) || p.codigo_barras;
                    if (barCode) {
                        html += `<option value="${barCode}">[BARRAS] ${barCode} ➔ ${cod} (${desc})</option>`;
                    }
                });
                datalist.innerHTML = html;
            }
        }

        function closeNewValidadeModal() {
            const modal = document.getElementById('newValidadeModal');
            if (modal) modal.classList.add('pointer-events-none', 'opacity-0');
            toggleMultiPalletSplit(false);
            toggleValidadeCalculator(false);
        }

        function onValidadeCodeOrLoteChange() {
            const codeInp = document.getElementById('valInputCodigo');
            if (codeInp && codeInp.value) codeInp.value = codeInp.value.toUpperCase();
            const loteInp = document.getElementById('valInputLote');
            if (loteInp && loteInp.value) loteInp.value = loteInp.value.toUpperCase();

            onValidadeCodeInput();
            const code = codeInp ? codeInp.value.trim().toUpperCase() : '';
            const lote = loteInp ? loteInp.value.trim().toUpperCase() : '';
            const armazem = document.getElementById('valInputArmazem').value.trim().padStart(2, '0');
            const selModalFilial = document.getElementById('valInputFilial');
            const targetFilial = (selModalFilial && selModalFilial.value) ? String(selModalFilial.value).padStart(2, '0') : '01';

            updateModalSaldoComparison();

            const unit = getProductUnit(code);

            // Se for novo lote (valEditId vazio): mantém limpo para preenchimento com a unidade do produto
            const isEditing = Boolean(document.getElementById('valEditId').value);
            if (!isEditing) {
                if (modalPalletRows.length === 1 && modalPalletRows[0].isNew && !modalPalletRows[0].qtd) {
                    modalPalletRows[0].nome = unit;
                }
                renderModalPalletRows();
                return;
            }

            if (!code) {
                modalPalletRows = [{ id: 'row_init', isNew: true, dbId: null, nome: unit, qtd: '' }];
                renderModalPalletRows();
                return;
            }

            // Procura lotes já existentes desse material nesse armazém da filial selecionada
            let existingLots = rawValidadeDataset.filter(v => 
                isFilialMatch(v.filial, targetFilial) &&
                isArmMatch(v.armazem, armazem) &&
                String(v.produto).trim().toUpperCase() === code
            );

            if (lote) {
                const loteMatched = existingLots.filter(v => String(v.lote || '').trim().toUpperCase() === lote);
                if (loteMatched.length > 0) {
                    existingLots = loteMatched;
                }
            }

            if (existingLots.length > 0) {
                // Preenche dados do lote com o primeiro registro existente
                const firstLot = existingLots[0];
                if (!lote && firstLot.lote) {
                    if (loteInp) loteInp.value = firstLot.lote;
                }
                const fabInp = document.getElementById('valInputFabricacao');
                if (fabInp && !fabInp.value && firstLot.data_fabricacao) {
                    fabInp.value = String(firstLot.data_fabricacao).slice(0, 7);
                }
                const valInp = document.getElementById('valInputValidade');
                if (valInp && !valInp.value && firstLot.data_validade) {
                    valInp.value = String(firstLot.data_validade).slice(0, 7);
                }
                const obsInp = document.getElementById('valInputObservacao');
                if (obsInp && !obsInp.value && firstLot.observacao) {
                    obsInp.value = firstLot.observacao;
                }

                // Carrega todos os paletes existentes desse lote/material na lista
                modalPalletRows = existingLots.map((l, idx) => ({
                    id: 'lot_' + l.id,
                    isNew: false,
                    dbId: l.id,
                    nome: l.embalagem || (idx === 0 ? unit : `${unit} ${idx+1}`),
                    qtd: l.quantidade
                }));
            }

            renderModalPalletRows();
        }

        function openEditValidadeModal(id) {
            const item = rawValidadeDataset.find(v => String(v.id) === String(id) || Number(v.id) === Number(id));
            if (!item) return;
            
            const modal = document.getElementById('newValidadeModal');
            const inpCodigo = document.getElementById('valInputCodigo');
            const title = document.getElementById('newValidadeModalTitle');

            if (title) title.innerText = `Editar Lote: ${item.lote || item.produto}`;
            document.getElementById('valEditId').value = item.id;
            if (inpCodigo) inpCodigo.value = item.produto;
            
            // Popula filial do item editado e carrega armazéns correspondentes
            populateModalFilialSelect(item.filial);
            updateModalWarehousesForSelectedFilial();
            document.getElementById('valInputArmazem').value = item.armazem;

            document.getElementById('valInputLote').value = item.lote || '';
            document.getElementById('valInputFabricacao').value = item.data_fabricacao ? String(item.data_fabricacao).slice(0, 7) : '';
            document.getElementById('valInputValidade').value = item.data_validade ? String(item.data_validade).slice(0, 7) : '';
            document.getElementById('valInputObservacao').value = item.observacao || '';

            // Preenche códigos externos
            const fornRecord = fornecedorByNossoMap[item.produto];
            const fornInp = document.getElementById('valInputCodFornecedor');
            const barInp = document.getElementById('valInputCodBarras');
            if (fornInp) fornInp.value = fornRecord ? (fornRecord.codigo_fornecedor || '') : '';
            if (barInp) {
                const pInfo = rawSb1Dataset.find(p => String(p.Codigo || p.codigo).trim().toUpperCase() === item.produto);
                barInp.value = (fornRecord && fornRecord.codigo_barras) ? fornRecord.codigo_barras : (pInfo ? pInfo.codigo_barras || '' : '');
            }

            const unit = getProductUnit(item.produto);
            deletedPalletDbIds = [];
            modalPalletRows = [{
                id: 'lot_' + item.id,
                isNew: false,
                dbId: item.id,
                nome: item.embalagem || unit,
                qtd: item.quantidade
            }];

            renderModalPalletRows();
            populateProductsDatalist();
            onValidadeCodeInput();
            updateModalSaldoComparison();
            if (modal) modal.classList.remove('pointer-events-none', 'opacity-0');
        }

        let debounceValidadeTimer = null;
        async function onValidadeCodeInput() {
            const inp = document.getElementById('valInputCodigo');
            const preview = document.getElementById('valProductPreviewLabel');
            const statusBadge = document.getElementById('valCodigosStatusBadge');
            const fornInp = document.getElementById('valInputCodFornecedor');
            const barInp = document.getElementById('valInputCodBarras');
            const btnSave = document.getElementById('btnSaveValidade');
            const btnPrint = document.getElementById('btnSaveAndPrintValidade');
            if (!inp || !preview) return;

            const val = inp.value.trim().toUpperCase();
            if (!val) {
                preview.innerHTML = `<span class="text-slate-400">Digite um código ou selecione da lista para buscar...</span>`;
                if (statusBadge) statusBadge.innerText = '';
                if (btnSave) btnSave.disabled = false;
                if (btnPrint) btnPrint.disabled = false;
                updateModalSaldoComparison();
                return;
            }

            preview.innerHTML = `<span class="text-slate-400 flex items-center gap-1"><i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin inline"></i> Verificando código no sistema...</span>`;
            if (typeof lucide !== 'undefined') lucide.createIcons();

            clearTimeout(debounceValidadeTimer);
            debounceValidadeTimer = setTimeout(async () => {
                try {
                    const found = await findProductByAnyCode(val);

                    if (found && found.product) {
                        const prod = found.product;
                        const internalCode = String(prod.Codigo || prod.codigo).trim().toUpperCase();
                        const desc = prod['Descr.Espec.'] || prod.descricao || '-';
                        
                        let badgeMsg = '';
                        if (found.matchType === 'CODIGO_FORNECEDOR') {
                            badgeMsg = `<span class="text-blue-600 dark:text-blue-400 flex items-center gap-1 font-bold"><i data-lucide="check-circle-2" class="w-3.5 h-3.5 inline"></i> <b>Cód. Fornecedor: "${val}"</b> ➔ [${internalCode}] ${desc}</span>`;
                            inp.value = internalCode;
                        } else if (found.matchType === 'CODIGO_BARRAS') {
                            badgeMsg = `<span class="text-purple-600 dark:text-purple-400 flex items-center gap-1 font-bold"><i data-lucide="check-circle-2" class="w-3.5 h-3.5 inline"></i> <b>Cód. Barras: "${val}"</b> ➔ [${internalCode}] ${desc}</span>`;
                            inp.value = internalCode;
                        } else {
                            badgeMsg = `<span class="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-bold"><i data-lucide="check-circle-2" class="w-3.5 h-3.5 inline"></i> ${desc}</span>`;
                        }
                        preview.innerHTML = badgeMsg;

                        // Preenche campos de código externo
                        const fornRecord = fornecedorByNossoMap[internalCode];
                        if (fornInp) fornInp.value = fornRecord ? (fornRecord.codigo_fornecedor || '') : '';
                        if (barInp) barInp.value = (fornRecord && fornRecord.codigo_barras) ? fornRecord.codigo_barras : (prod.codigo_barras || '');

                        if (statusBadge) {
                            let parts = [];
                            if (fornRecord && fornRecord.codigo_fornecedor) parts.push(`Forn: ${fornRecord.codigo_fornecedor}`);
                            const curBar = (fornRecord && fornRecord.codigo_barras) || prod.codigo_barras;
                            if (curBar) parts.push(`Barras: ${curBar}`);
                            statusBadge.innerText = parts.length > 0 ? parts.join(' | ') : 'Sem códigos externos';
                        }

                        if (btnSave) btnSave.disabled = false;
                        if (btnPrint) btnPrint.disabled = false;
                    } else {
                        // PRODUTO NÃO EXISTE NO SISTEMA: BLOQUEIA
                        preview.innerHTML = `<span class="text-rose-600 dark:text-rose-400 flex items-center gap-1 font-bold"><i data-lucide="alert-circle" class="w-3.5 h-3.5 inline"></i> ❌ Código "${val}" NÃO existe no sistema (nem no SB1 nem por fornecedor/barras). Não é permitido cadastrar.</span>`;
                        if (statusBadge) statusBadge.innerText = 'Não vinculado';
                        if (btnSave) btnSave.disabled = true;
                        if (btnPrint) btnPrint.disabled = true;
                    }
                } catch(err) {
                    console.warn("Erro ao checar código no sistema:", err);
                } finally {
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                    updateModalSaldoComparison();
                }
            }, 300);
        }

        function updateModalSaldoComparison() {
            const card = document.getElementById('valSaldoComparisonCard');
            const elSaldo = document.getElementById('valModalSaldoSistema');
            const elSoma = document.getElementById('valModalSomaLotes');
            const elRest = document.getElementById('valModalSaldoRestante');
            const elBadge = document.getElementById('valModalSaldoStatusBadge');
            const elExp = document.getElementById('valModalSaldoExplanation');
            if (!card) return;

            const codeInput = document.getElementById('valInputCodigo');
            const armazemInput = document.getElementById('valInputArmazem');
            if (!codeInput || !armazemInput) return;

            const code = codeInput.value.trim().toUpperCase();
            const armazem = armazemInput.value.trim().padStart(2, '0');
            const selModalFilial = document.getElementById('valInputFilial');
            const targetFilial = (selModalFilial && selModalFilial.value) ? String(selModalFilial.value).padStart(2, '0') : '01';

            if (!code || !armazem) {
                card.classList.add('hidden');
                return;
            }

            const comp = getBalanceComparison(targetFilial, armazem, code);
            card.classList.remove('hidden');

            let currentRowsSum = 0;
            modalPalletRows.forEach(r => currentRowsSum += (parseFloat(r.qtd) || 0));

            if (elSaldo) elSaldo.innerText = comp.saldoSistema.toLocaleString('pt-BR');
            if (elSoma) elSoma.innerText = currentRowsSum.toLocaleString('pt-BR');
            
            if (elRest) {
                const diff = currentRowsSum - comp.saldoSistema;
                if (Math.abs(diff) < 0.001) {
                    elRest.innerText = "0 (Alinhado)";
                    elRest.className = "font-black text-emerald-600 dark:text-emerald-400 text-xs mt-0.5";
                } else if (diff < 0) {
                    elRest.innerText = `Falta ${Math.abs(diff).toLocaleString('pt-BR')}`;
                    elRest.className = "font-black text-amber-600 dark:text-amber-400 text-xs mt-0.5 animate-pulse";
                } else {
                    elRest.innerText = `Excede +${diff.toLocaleString('pt-BR')}`;
                    elRest.className = "font-black text-rose-600 dark:text-rose-400 text-xs mt-0.5 animate-pulse";
                }
            }

            if (elBadge) {
                const diff = currentRowsSum - comp.saldoSistema;
                if (Math.abs(diff) < 0.001) {
                    elBadge.className = "px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800";
                    elBadge.innerText = "🟢 Saldo Alinhado";
                } else if (diff < 0) {
                    elBadge.className = "px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900";
                    elBadge.innerText = "🟡 Falta Registrar Lote";
                } else {
                    elBadge.className = "px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-900";
                    elBadge.innerText = "🔴 Lotes Excedentes";
                }
            }

            if (elExp) {
                const diff = currentRowsSum - comp.saldoSistema;
                if (Math.abs(diff) < 0.001) {
                    elExp.innerText = "A soma dos lotes cadastrados confere perfeitamente com o saldo atual no sistema.";
                } else if (diff < 0) {
                    elExp.innerHTML = `O sistema possui <b>${comp.saldoSistema.toLocaleString('pt-BR')}</b> no Armazém ${armazem}, mas apenas <b>${currentRowsSum.toLocaleString('pt-BR')}</b> estão divididos em lotes. Restam <b>${Math.abs(diff).toLocaleString('pt-BR')}</b> sem lote. <span class="text-amber-700 font-bold underline cursor-pointer hover:text-amber-900" onclick="fillRemainingBalanceToInput()">Clique aqui para preencher</span>.`;
                } else {
                    elExp.innerText = `Atenção: A soma dos lotes (${currentRowsSum.toLocaleString('pt-BR')}) é maior que o saldo no sistema (${comp.saldoSistema.toLocaleString('pt-BR')}). Verifique se houve transferência sem lista ou se o físico precisa de recontagem.`;
                }
            }

            if (typeof lucide !== 'undefined') lucide.createIcons();
        }

        function fillRemainingBalanceToInput() {
            const codeInput = document.getElementById('valInputCodigo');
            const armazemInput = document.getElementById('valInputArmazem');
            if (!codeInput || !armazemInput) return;

            const code = codeInput.value.trim().toUpperCase();
            const armazem = armazemInput.value.trim().padStart(2, '0');
            const selModalFilial = document.getElementById('valInputFilial');
            const targetFilial = (selModalFilial && selModalFilial.value) ? String(selModalFilial.value).padStart(2, '0') : '01';
            const comp = getBalanceComparison(targetFilial, armazem, code);

            let currentRowsSum = 0;
            modalPalletRows.forEach(r => currentRowsSum += (parseFloat(r.qtd) || 0));
            const diff = currentRowsSum - comp.saldoSistema;

            if (diff < 0) {
                const missingQtd = Math.abs(diff);
                const code = codeInput ? codeInput.value.trim().toUpperCase() : '';
                const unit = getProductUnit(code);
                addModalPalletRow({
                    id: 'row_' + Date.now(),
                    isNew: true,
                    dbId: null,
                    nome: unit,
                    qtd: missingQtd
                });
                showAlert(`Nova linha adicionada com a quantidade restante de ${missingQtd.toLocaleString('pt-BR')} ${unit}.`, "info");
            }
        }

        async function saveValidadeEntry(e) {
            if (e) e.preventDefault();
            const produtoInput = document.getElementById('valInputCodigo');
            const produto = produtoInput ? produtoInput.value.trim().toUpperCase() : '';
            const armazem = document.getElementById('valInputArmazem').value.padStart(2, '0');
            const lote = document.getElementById('valInputLote').value.trim().toUpperCase();
            const fabricacao = document.getElementById('valInputFabricacao').value;
            const validade = document.getElementById('valInputValidade').value;
            const obs = document.getElementById('valInputObservacao').value.trim();

            if (!produto) {
                showAlert("Por favor, informe o código do produto.", "warning");
                return false;
            }

            // --- VALIDAÇÃO ESTRITA: O PRODUTO DEVE EXISTIR NO CADASTRO DO SB1 ---
            let matchProd = rawSb1Dataset ? rawSb1Dataset.find(p => String(p.Codigo || p.codigo).trim().toUpperCase() === produto) : null;
            if (!matchProd) {
                const sb1Table = currentSector === 'INDUSTRIA' ? 'sb1_industria' : 'sb1_comercio';
                let { data: dbCheck } = await supabaseClient.from(sb1Table).select('codigo, descricao, unidade').eq('codigo', produto).maybeSingle();
                if (!dbCheck && currentSector === 'COMERCIO') {
                    const { data: indCheck } = await supabaseClient.from('sb1_industria').select('codigo, descricao, unidade').eq('codigo', produto).maybeSingle();
                    dbCheck = indCheck;
                }

                if (dbCheck && dbCheck.codigo) {
                    matchProd = {
                        Codigo: String(dbCheck.codigo).trim(),
                        codigo: String(dbCheck.codigo).trim(),
                        'Descr.Espec.': dbCheck.descricao || '-',
                        descricao: dbCheck.descricao || '-',
                        Unidade: dbCheck.unidade || 'UN',
                        unidade: dbCheck.unidade || 'UN'
                    };
                    rawSb1Dataset.push(matchProd);
                }
            }

            if (!matchProd) {
                showAlert(`❌ O código "${produto}" NÃO existe no cadastro de materiais do sistema (SB1). Não é permitido cadastrar lotes para itens inexistentes.`, "error");
                const btn = document.getElementById('btnSaveValidade');
                const btnPrint = document.getElementById('btnSaveAndPrintValidade');
                if (btn) btn.disabled = false;
                if (btnPrint) btnPrint.disabled = false;
                return false;
            }

            if (!validade) {
                showAlert("Por favor, informe a Data de Validade Final (Mês/Ano).", "warning");
                return false;
            }

            const validRows = modalPalletRows.filter(r => (parseFloat(r.qtd) || 0) > 0);
            if (validRows.length === 0) {
                showAlert("Informe a quantidade para ao menos um palete.", "warning");
                return false;
            }

            const selModalFilial = document.getElementById('valInputFilial');
            const targetFilial = (selModalFilial && selModalFilial.value) ? String(selModalFilial.value).padStart(2, '0') : '01';
            const valTable = currentSector === 'INDUSTRIA' ? 'validade_industria' : 'validade_comercio';

            const btn = document.getElementById('btnSaveValidade');
            const btnPrint = document.getElementById('btnSaveAndPrintValidade');
            if (btn) btn.disabled = true;
            if (btnPrint) btnPrint.disabled = true;

            // Sincroniza códigos externos se foram alterados no sub-card
            const fornInpVal = document.getElementById('valInputCodFornecedor') ? document.getElementById('valInputCodFornecedor').value.trim().toUpperCase() : '';
            const barInpVal = document.getElementById('valInputCodBarras') ? document.getElementById('valInputCodBarras').value.trim().toUpperCase() : '';

            if (fornInpVal) {
                const currentForn = fornecedorByNossoMap[produto] ? (fornecedorByNossoMap[produto].codigo_fornecedor || '') : '';
                if (fornInpVal !== currentForn) {
                    saveSupplierCodeForProduct(produto, fornInpVal).catch(e => console.warn("Aviso ao salvar cód. fornecedor:", e));
                }
            }
            if (barInpVal) {
                const currentBar = (fornecedorByNossoMap[produto] && fornecedorByNossoMap[produto].codigo_barras) || (matchProd && matchProd.codigo_barras) || '';
                if (barInpVal !== currentBar) {
                    saveBarcodeForProduct(produto, barInpVal).catch(e => console.warn("Aviso ao salvar cód. barras:", e));
                }
            }

            try {
                // 1. Deleta paletes removidos
                if (deletedPalletDbIds.length > 0) {
                    const { error: delErr } = await supabaseClient.from(valTable).delete().in('id', deletedPalletDbIds);
                    if (delErr) console.error("Erro ao deletar paletes removidos:", delErr);
                    deletedPalletDbIds = [];
                }

                // 2. Separa em inserts e updates
                const inserts = [];
                const updates = [];

                validRows.forEach(r => {
                    const payload = {
                        filial: targetFilial,
                        armazem: armazem,
                        produto: produto,
                        lote: lote || null,
                        quantidade: parseFloat(r.qtd) || 0,
                        embalagem: (r.nome || getProductUnit(produto)).trim().toUpperCase(),
                        data_fabricacao: fabricacao || null,
                        data_validade: validade,
                        quem_registrou: currentUser ? currentUser.nome : 'SISTEMA',
                        observacao: obs || null
                    };

                    if (r.dbId) {
                        updates.push({ id: r.dbId, payload });
                    } else {
                        inserts.push(payload);
                    }
                });

                if (updates.length > 0) {
                    for (const up of updates) {
                        const { error } = await supabaseClient.from(valTable).update(up.payload).eq('id', up.id);
                        if (error) throw error;
                    }
                }

                if (inserts.length > 0) {
                    const { error } = await supabaseClient.from(valTable).insert(inserts);
                    if (error) throw error;
                }

                // Registra na Trilha de Auditoria
                const totalQtdSaved = validRows.reduce((acc, r) => acc + (parseFloat(r.qtd) || 0), 0);
                logAuditAction({
                    filial: targetFilial,
                    armazem: armazem,
                    produto: produto,
                    lote: lote || 'SEM_LOTE',
                    acao: updates.length > 0 ? 'EDICAO_LOTE' : 'INCLUSAO_PALETE',
                    detalhes: `Salvo ${validRows.length} palete(s) (Total: ${totalQtdSaved.toLocaleString('pt-BR')}) com validade ${validade}. ${obs ? `Obs: ${obs}` : ''}`,
                    modulo: 'VALIDADE'
                });

                showAlert(`${validRows.length} palete(s) salvos com sucesso!`, "success");
                closeNewValidadeModal();
                await loadValidadeData();
                return true;
            } catch(err) {
                console.error("Erro ao salvar validade:", err);
                showAlert(`Erro ao salvar validade: ${err.message}`, "error");
                return false;
            } finally {
                if (btn) btn.disabled = false;
                if (btnPrint) btnPrint.disabled = false;
            }
        }

        async function saveAndPrintValidadeA4() {
            const produtoInput = document.getElementById('valInputCodigo');
            const produto = produtoInput ? produtoInput.value.trim().toUpperCase() : '';
            const armazem = document.getElementById('valInputArmazem').value.padStart(2, '0');
            const selModalFilial = document.getElementById('valInputFilial');
            const targetFilial = (selModalFilial && selModalFilial.value) ? String(selModalFilial.value).padStart(2, '0') : '01';

            const saved = await saveValidadeEntry();
            if (!saved) return;

            // Abre o modal oficial A4 com todos os lotes salvos
            openA4PalletPrintModal(targetFilial, armazem, produto);
        }

        // --- IMPORTAÇÃO DE PLANILHA EXCEL (.XLSX) ---

        function openImportValidadeModal() {
            stagedImportRows = [];
            const fileInput = document.getElementById('importValidadeFileInput');
            if (fileInput) fileInput.value = '';
            const lbl = document.getElementById('importFileNameLabel');
            if (lbl) lbl.innerText = "Clique aqui ou arraste a planilha Excel (.xlsx, .csv)";
            const previewCont = document.getElementById('importPreviewContainer');
            if (previewCont) previewCont.classList.add('hidden');
            const summary = document.getElementById('importSummaryBar');
            if (summary) summary.classList.add('hidden');
            const btn = document.getElementById('btnExecuteImportValidade');
            if (btn) btn.disabled = true;

            populateImportFilialSelect();

            const modal = document.getElementById('importValidadeModal');
            if (modal) modal.classList.remove('pointer-events-none', 'opacity-0');
        }

        function closeImportValidadeModal() {
            const modal = document.getElementById('importValidadeModal');
            if (modal) modal.classList.add('pointer-events-none', 'opacity-0');
        }

        function parseExcelDate(serialOrStr) {
            if (serialOrStr === null || serialOrStr === undefined) return '';
            if (typeof serialOrStr === 'number') {
                const utcDays = Math.floor(serialOrStr - 25569);
                const date = new Date(utcDays * 86400 * 1000);
                const y = date.getUTCFullYear();
                const m = String(date.getUTCMonth() + 1).padStart(2, '0');
                return `${y}-${m}`;
            }
            const s = String(serialOrStr).trim();
            if (!s) return '';
            if (/^\d{4}-\d{2}/.test(s)) return s.slice(0, 7);
            if (/^\d{1,2}\/\d{4}$/.test(s)) {
                const [m, y] = s.split('/');
                return `${y}-${m.padStart(2, '0')}`;
            }
            if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
                const parts = s.split('/');
                return `${parts[2]}-${parts[1].padStart(2, '0')}`;
            }
            const num = parseFloat(s);
            if (!isNaN(num) && num > 30000 && num < 70000) {
                return parseExcelDate(num);
            }
            return s;
        }

        function formatExcelProductCode(val) {
            if (val === null || val === undefined) return '';
            const s = String(val).trim();
            const num = parseFloat(s);
            if (!isNaN(num) && num > 0 && num < 99999999 && !s.includes('.') && s.length <= 8) {
                return s.padStart(8, '0');
            }
            if (!isNaN(num) && num >= 10000000) {
                return Math.round(num).toString().padStart(8, '0');
            }
            return s;
        }

        function handleValidadeFileSelected(input) {
            const file = input.files[0];
            if (!file) return;

            document.getElementById('importFileNameLabel').innerText = `📄 ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;

            const reader = new FileReader();
            reader.onload = async function(e) {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

                    if (rawRows.length < 2) {
                        showAlert("A planilha selecionada está vazia ou sem cabeçalhos.", "warning");
                        return;
                    }

                    // Identifica colunas pelo cabeçalho (linha 0)
                    const header = rawRows[0].map(h => String(h).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
                    
                    let colCod = header.findIndex(h => h.includes('codigo') || h.includes('cod') || h.includes('produto') || h.includes('material'));
                    let colLote = header.findIndex(h => h.includes('lote') || h.includes('batch'));
                    let colQtd = header.findIndex(h => h.includes('quant') || h.includes('qtd') || h.includes('qtde'));
                    let colVal = header.findIndex(h => h.includes('valid') || h.includes('venc') || h.includes('mes'));
                    let colEmb = header.findIndex(h => h.includes('palete') || h.includes('caixa') || h.includes('embalag') || h.includes('unid') || h.includes('tipo'));

                    // Fallbacks padrão de posições se cabeçalho simples
                    if (colCod === -1) colCod = 0;
                    if (colLote === -1) colLote = 1;
                    if (colQtd === -1) colQtd = 2;
                    if (colVal === -1) colVal = 3;
                    if (colEmb === -1) colEmb = 4;

                    const defaultArm = document.getElementById('importDefaultArmazem').value.padStart(2, '0');
                    const selFilial = document.getElementById('importValidadeFilial');
                    const targetFilial = (selFilial && selFilial.value) ? String(selFilial.value).padStart(2, '0') : '01';

                    const sb1Map = {};
                    rawSb1Dataset.forEach(p => {
                        const c = p.Codigo;
                        if (c) sb1Map[c] = p['Descr.Espec.'] || '-';
                    });

                    stagedImportRows = [];

                    for (let i = 1; i < rawRows.length; i++) {
                        const row = rawRows[i];
                        const rawCod = row[colCod];
                        if (!rawCod && rawCod !== 0) continue;

                        const cod = formatExcelProductCode(rawCod);
                        const lote = String(row[colLote] || '').trim().toUpperCase();
                        const qtd = parseFloat(row[colQtd]) || 0;
                        const valDate = parseExcelDate(row[colVal]);
                        const embalagem = String(row[colEmb] || '').trim().toUpperCase();

                        if (!cod) continue;

                        stagedImportRows.push({
                            filial: targetFilial,
                            armazem: defaultArm,
                            produto: cod,
                            descricao: sb1Map[cod] || null,
                            lote: lote,
                            quantidade: qtd,
                            embalagem: embalagem,
                            data_validade: valDate,
                            quem_registrou: currentUser ? currentUser.nome : 'SISTEMA',
                            observacao: `Importado via planilha ${file.name}`,
                            valido: true
                        });
                    }

                    if (stagedImportRows.length === 0) {
                        showAlert("Nenhuma linha válida encontrada na planilha.", "warning");
                        return;
                    }

                    // --- VALIDAÇÃO CONTRA O SB1: BUSCA CÓDIGOS NÃO PRESENTES NO CACHE ---
                    const missingCodes = [...new Set(stagedImportRows.filter(r => !r.descricao).map(r => r.produto))];
                    if (missingCodes.length > 0) {
                        const sb1Table = currentSector === 'INDUSTRIA' ? 'sb1_industria' : 'sb1_comercio';
                        const { data: dbMatched } = await supabaseClient.from(sb1Table)
                            .select('codigo, descricao')
                            .in('codigo', missingCodes);

                        const dbMap = {};
                        if (dbMatched) {
                            dbMatched.forEach(p => {
                                dbMap[String(p.codigo).trim().toUpperCase()] = p.descricao;
                            });
                        }

                        // Se estiver no comércio e faltou algum, checa indústria
                        const stillMissing = missingCodes.filter(c => !dbMap[c]);
                        if (stillMissing.length > 0 && currentSector === 'COMERCIO') {
                            const { data: indMatched } = await supabaseClient.from('sb1_industria')
                                .select('codigo, descricao')
                                .in('codigo', stillMissing);
                            if (indMatched) {
                                indMatched.forEach(p => {
                                    dbMap[String(p.codigo).trim().toUpperCase()] = p.descricao;
                                });
                            }
                        }

                        stagedImportRows.forEach(item => {
                            if (!item.descricao) {
                                if (dbMap[item.produto]) {
                                    item.descricao = dbMap[item.produto];
                                    item.valido = true;
                                } else {
                                    item.descricao = "❌ PRODUTO NÃO EXISTE NO SB1";
                                    item.valido = false;
                                }
                            }
                        });
                    }

                    const invalidCount = stagedImportRows.filter(r => !r.valido).length;
                    const validCount = stagedImportRows.length - invalidCount;

                    // Renderiza prévia
                    const tbody = document.getElementById('importPreviewBody');
                    tbody.innerHTML = '';
                    stagedImportRows.forEach(item => {
                        const tr = document.createElement('tr');
                        if (!item.valido) {
                            tr.className = "bg-rose-50/80 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border-l-4 border-rose-500";
                            tr.innerHTML = `
                                <td class="p-2 font-black text-rose-700">${item.produto}</td>
                                <td class="p-2 font-bold text-rose-600 truncate max-w-[150px]">${item.descricao}</td>
                                <td class="p-2"><span class="px-1.5 py-0.5 bg-rose-100 text-rose-800 rounded font-black text-[10px]">${item.lote || '-'}</span></td>
                                <td class="p-2 text-right font-black text-rose-700">${item.quantidade.toLocaleString('pt-BR')}</td>
                                <td class="p-2 text-rose-600">${item.embalagem || '-'}</td>
                                <td class="p-2 text-center font-bold text-rose-800">${formatAnoMesDisplay(item.data_validade)}</td>
                            `;
                        } else {
                            tr.innerHTML = `
                                <td class="p-2 font-black text-slate-900 dark:text-white">${item.produto}</td>
                                <td class="p-2 text-slate-600 dark:text-slate-300 truncate max-w-[150px]">${item.descricao}</td>
                                <td class="p-2"><span class="px-1.5 py-0.5 bg-blue-50 text-blue-800 rounded font-black text-[10px]">${item.lote || '-'}</span></td>
                                <td class="p-2 text-right font-black text-[#002f6c] dark:text-blue-400">${item.quantidade.toLocaleString('pt-BR')}</td>
                                <td class="p-2 text-slate-600 dark:text-slate-400">${item.embalagem || '-'}</td>
                                <td class="p-2 text-center font-bold text-slate-800 dark:text-slate-200">${formatAnoMesDisplay(item.data_validade)}</td>
                            `;
                        }
                        tbody.appendChild(tr);
                    });

                    document.getElementById('importPreviewContainer').classList.remove('hidden');
                    const summary = document.getElementById('importSummaryBar');
                    summary.classList.remove('hidden');
                    
                    if (invalidCount > 0) {
                        document.getElementById('importSummaryCount').innerHTML = `<span class="text-emerald-700 font-black">${validCount} válidos</span> • <span class="text-rose-600 font-black">${invalidCount} bloqueados (inexistentes no SB1)</span>`;
                    } else {
                        document.getElementById('importSummaryCount').innerText = `${validCount} lotes identificados e 100% validados no SB1`;
                    }

                    document.getElementById('btnExecuteImportValidade').disabled = (validCount === 0);

                } catch (err) {
                    console.error("Erro ao ler planilha:", err);
                    showAlert("Erro ao processar o arquivo Excel: " + err.message, "error");
                }
            };
            reader.readAsArrayBuffer(file);
        }

        async function executeValidadeImport() {
            const validRowsToImport = stagedImportRows.filter(r => r.valido !== false);
            const blockedInvalidCount = stagedImportRows.length - validRowsToImport.length;

            if (validRowsToImport.length === 0) {
                showAlert("Nenhum lote válido no cadastro do SB1 para importar.", "warning");
                if (btn) btn.disabled = false;
                if (loader) loader.classList.add('hidden');
                return;
            }

            const defaultArm = document.getElementById('importDefaultArmazem').value.padStart(2, '0');
            const duplicateRule = document.getElementById('importDuplicateRule').value;
            const selImportFil = document.getElementById('importValidadeFilial');
            const targetFilial = (selImportFil && selImportFil.value) ? String(selImportFil.value).padStart(2, '0') : '01';
            const valTable = currentSector === 'INDUSTRIA' ? 'validade_industria' : 'validade_comercio';

            const btn = document.getElementById('btnExecuteImportValidade');
            if (btn) btn.disabled = true;

            const loader = document.getElementById('globalLoader');
            if (loader) loader.classList.remove('hidden');

            try {
                let inserted = 0;
                let updated = 0;

                for (const row of validRowsToImport) {
                    row.armazem = defaultArm;
                    row.filial = targetFilial;

                    // Busca se o lote já existe para esse produto e armazém
                    const { data: existing } = await supabaseClient
                        .from(valTable)
                        .select('id')
                        .eq('filial', targetFilial)
                        .eq('armazem', defaultArm)
                        .eq('produto', row.produto)
                        .eq('lote', row.lote || '');

                    if (existing && existing.length > 0) {
                        if (duplicateRule === 'UPDATE') {
                            await supabaseClient.from(valTable).update({
                                quantidade: row.quantidade,
                                embalagem: row.embalagem || null,
                                data_validade: row.data_validade || null,
                                quem_registrou: row.quem_registrou,
                                observacao: row.observacao
                            }).eq('id', existing[0].id);
                            updated++;
                        }
                    } else {
                        const { descricao, valido, ...payload } = row;
                        await supabaseClient.from(valTable).insert([payload]);
                        inserted++;
                    }
                }

                const msgBlocked = blockedInvalidCount > 0 ? ` (${blockedInvalidCount} bloqueados por não existirem no SB1)` : '';
                showAlert(`Importação concluída! ${inserted} lotes inseridos e ${updated} atualizados.${msgBlocked}`, "success");
                closeImportValidadeModal();
                await loadValidadeData();

            } catch (err) {
                console.error("Erro na importação:", err);
                showAlert(`Erro durante a importação: ${err.message}`, "error");
            } finally {
                if (loader) loader.classList.add('hidden');
                if (btn) btn.disabled = false;
            }
        }

        // --- TRANSFERÊNCIA PARA ARMAZÉM DE VENCIDOS ---

        function openTransferValidadeModal(id) {
            const item = rawValidadeDataset.find(v => String(v.id) === String(id) || Number(v.id) === Number(id));
            if (!item) return;

            const sb1Map = {};
            rawSb1Dataset.forEach(p => {
                const c = p.Codigo;
                if (c) sb1Map[c] = p['Descr.Espec.'] || '-';
            });

            document.getElementById('valTransferId').value = item.id;
            document.getElementById('valTransferProdDesc').innerText = `${item.produto} - ${sb1Map[item.produto] || '-'}`;
            document.getElementById('valTransferInfo').innerText = `Lote: ${item.lote || 'Sem lote'} | Armazém ${item.armazem} → Armazém Destino (Validade: ${formatAnoMesDisplay(item.data_validade)})`;
            document.getElementById('valTransferDestinoArmazem').value = '50';
            document.getElementById('valTransferObs').value = `Transferido do Armazém ${item.armazem} para Armazém 50 (Vencidos)`;

            const modal = document.getElementById('transferValidadeModal');
            if (modal) modal.classList.remove('pointer-events-none', 'opacity-0');
        }

        function closeTransferValidadeModal() {
            const modal = document.getElementById('transferValidadeModal');
            if (modal) modal.classList.add('pointer-events-none', 'opacity-0');
        }

        async function executeTransferValidade() {
            const id = document.getElementById('valTransferId').value;
            const destinoArm = document.getElementById('valTransferDestinoArmazem').value.padStart(2, '0');
            const obsMov = document.getElementById('valTransferObs').value.trim();

            if (!id) return;

            const item = rawValidadeDataset.find(v => String(v.id) === String(id) || Number(v.id) === Number(id));
            if (!item) return;

            const valTable = currentSector === 'INDUSTRIA' ? 'validade_industria' : 'validade_comercio';
            const newObs = item.observacao ? `${item.observacao} | ${obsMov}` : obsMov;

            const btn = document.getElementById('btnExecuteTransferValidade');
            if (btn) btn.disabled = true;

            try {
                const { error } = await supabaseClient.from(valTable).update({
                    armazem: destinoArm,
                    observacao: newObs,
                    quem_registrou: currentUser ? currentUser.nome : 'SISTEMA'
                }).eq('id', item.id);

                if (error) throw error;

                logAuditAction({
                    filial: item.filial || '01',
                    armazem: item.armazem,
                    produto: item.produto,
                    lote: item.lote || 'SEM_LOTE',
                    acao: 'TRANSFERENCIA_ARMAZEM',
                    detalhes: `Lote ${item.lote || 'S/ Lote'} (${item.quantidade} un.) transferido do Armazém ${item.armazem} para Armazém ${destinoArm}. ${obsMov ? `Obs: ${obsMov}` : ''}`,
                    modulo: 'VALIDADE'
                });

                showAlert(`Datas de validade transferidas com sucesso para o Armazém ${destinoArm}!`, "success");
                closeTransferValidadeModal();
                await loadValidadeData();
            } catch(err) {
                console.error("Erro ao transferir validade:", err);
                showAlert(`Erro ao transferir validade: ${err.message}`, "error");
            } finally {
                if (btn) btn.disabled = false;
            }
        }

        async function deleteValidadeEntry(id) {
            const item = rawValidadeDataset.find(v => String(v.id) === String(id) || Number(v.id) === Number(id));
            if (!confirm("Tem certeza que deseja excluir este lote de validade?")) return;

            const valTable = currentSector === 'INDUSTRIA' ? 'validade_industria' : 'validade_comercio';
            try {
                const { error } = await supabaseClient.from(valTable).delete().eq('id', id);
                if (error) throw error;

                if (item) {
                    logAuditAction({
                        filial: item.filial || '01',
                        armazem: item.armazem,
                        produto: item.produto,
                        lote: item.lote || 'SEM_LOTE',
                        acao: 'EXCLUSAO_PALETE',
                        detalhes: `Exclusão do palete/lote: ${item.embalagem || 'PALETE'} (${item.quantidade} un., validade ${item.data_validade || '-'})`,
                        modulo: 'VALIDADE'
                    });
                }

                showAlert("Lote de validade excluído com sucesso!", "success");
                await loadValidadeData();
            } catch(err) {
                console.error("Erro ao excluir validade:", err);
                showAlert(`Erro ao excluir validade: ${err.message}`, "error");
            }
        }

        // --- EXPORTAÇÃO PARA EXCEL (.XLSX) ---

        function exportValidadeToExcel() {
            if (!groupedValidadeDataset || groupedValidadeDataset.length === 0) {
                showAlert("Nenhum registro de validade encontrado para exportar.", "warning");
                return;
            }

            const sb1Map = {};
            rawSb1Dataset.forEach(p => {
                const c = p.Codigo;
                if (c) {
                    sb1Map[c] = {
                        descricao: p['Descr.Espec.'] || '-',
                        unidade: p.Unidade || 'UN'
                    };
                }
            });

            const allExportRows = [];
            groupedValidadeDataset.forEach(item => {
                const sbInfo = sb1Map[item.produto] || { descricao: 'Material Não Cadastrado no SB1', unidade: 'UN' };
                const comp = getBalanceComparison(item.filial, item.armazem, item.produto);
                let situacaoSaldo = 'Alinhado (100%)';
                if (comp.status === 'FALTA_LOTE') situacaoSaldo = `Falta Lote (-${Math.abs(comp.diff)})`;
                else if (comp.status === 'EXCEDENTE') situacaoSaldo = `Lotes Excedentes (+${comp.diff})`;

                item.lotes.forEach(l => {
                    const status = getValidadeStatus(l.data_validade);
                    let statusText = 'No Prazo (OK)';
                    if (status === 'VENCIDO') statusText = 'Vencido';
                    else if (status === 'AVENCER') statusText = 'A Vencer (60d)';

                    allExportRows.push({
                        "Filial": item.filial || '01',
                        "Produto": item.produto || '',
                        "Descrição": sbInfo.descricao,
                        "Unidade de Medida": sbInfo.unidade,
                        "Armazem": item.armazem || '',
                        "Lote": l.lote || '',
                        "Qtd Lote": Number(l.quantidade || 0),
                        "Soma Total Lotes (Armazém)": Number(comp.totalLotes || 0),
                        "Saldo no Sistema (Armazém)": Number(comp.saldoSistema || 0),
                        "Diferença (Lotes - Sistema)": Number(comp.diff || 0),
                        "Situação Saldo": situacaoSaldo,
                        "Palete/Caixa/Unidade": l.embalagem || '',
                        "Mês de Fabricação": formatAnoMesDisplay(l.data_fabricacao),
                        "Mês de Vencimento": formatAnoMesDisplay(l.data_validade),
                        "Status Validade": statusText,
                        "Observação": l.observacao || ''
                    });
                });
            });

            if (allExportRows.length === 0) {
                showAlert("Nenhum lote registrado para exportar.", "warning");
                return;
            }

            const ws = XLSX.utils.json_to_sheet(allExportRows);

            ws['!cols'] = [
                { wch: 10 }, // Filial
                { wch: 18 }, // Produto
                { wch: 45 }, // Descrição
                { wch: 18 }, // Unidade de Medida
                { wch: 12 }, // Armazem
                { wch: 16 }, // Lote
                { wch: 12 }, // Qtd Lote
                { wch: 24 }, // Soma Total Lotes (Armazém)
                { wch: 24 }, // Saldo no Sistema (Armazém)
                { wch: 24 }, // Diferença (Lotes - Sistema)
                { wch: 22 }, // Situação Saldo
                { wch: 22 }, // Palete/Caixa/Unidade
                { wch: 20 }, // Mês de Fabricação
                { wch: 22 }, // Mês de Vencimento
                { wch: 18 }, // Status Validade
                { wch: 30 }  // Observação
            ];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Validades");

            const today = new Date().toISOString().split('T')[0];
            XLSX.writeFile(wb, `Validades_${today}.xlsx`);
            showAlert("Planilha de validades exportada com sucesso!", "success");
        }

        async function saveAndPrintArgoxLabel() {
            return saveAndPrintValidadeA4();
        }

        // =========================================================================
        // GESTÃO DE CÓDIGOS DE FORNECEDORES & CÓDIGOS DE BARRAS / QR CODE (MODAL)
        // =========================================================================
        let codigosManagerCatalog = [];

        async function openCodigosManagerModal(prefillSearch = '') {
            const modal = document.getElementById('modalCodigosManager');
            if (!modal) return;

            modal.classList.remove('pointer-events-none', 'opacity-0');
            const searchInp = document.getElementById('mgrCodigosSearchInput');
            if (searchInp) {
                searchInp.value = prefillSearch || '';
            }

            await loadCodigosManagerCatalog();
            filterCodigosManagerList();
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }

        function closeCodigosManagerModal() {
            const modal = document.getElementById('modalCodigosManager');
            if (modal) modal.classList.add('pointer-events-none', 'opacity-0');
        }

        async function loadCodigosManagerCatalog() {
            const countInfo = document.getElementById('mgrCodigosCountInfo');
            if (countInfo) countInfo.innerText = "Carregando catálogo de materiais...";

            const knownCodes = new Set();
            codigosManagerCatalog = [];

            // 1. Adiciona itens do cache SB1 já carregados
            (rawSb1Dataset || []).forEach(p => {
                const cod = String(p.Codigo || p.codigo || '').trim().toUpperCase();
                if (cod && !knownCodes.has(cod)) {
                    knownCodes.add(cod);
                    const fornInfo = fornecedorByNossoMap[cod] || {};
                    codigosManagerCatalog.push({
                        codigo: cod,
                        descricao: p['Descr.Espec.'] || p.descricao || '-',
                        codigo_fornecedor: fornInfo.codigo_fornecedor || '',
                        codigo_barras: fornInfo.codigo_barras || p.codigo_barras || ''
                    });
                }
            });

            // 2. Adiciona itens mapeados em fornecedores_produtos
            (rawFornecedoresProdutos || []).forEach(f => {
                const cod = String(f.codigo_nosso || '').trim().toUpperCase();
                if (cod && !knownCodes.has(cod)) {
                    knownCodes.add(cod);
                    codigosManagerCatalog.push({
                        codigo: cod,
                        descricao: f.descricao || 'Item Cadastrado em Fornecedores',
                        codigo_fornecedor: f.codigo_fornecedor || '',
                        codigo_barras: f.codigo_barras || ''
                    });
                }
            });

            // 3. Se o catálogo for pequeno, busca catálogo estendido do SB1 no Supabase
            if (codigosManagerCatalog.length < 300) {
                try {
                    const sb1Table = currentSector === 'INDUSTRIA' ? 'sb1_industria' : 'sb1_comercio';
                    const { data: moreSb1 } = await supabaseClient.from(sb1Table).select('codigo, descricao, codigo_barras').limit(1500);
                    if (moreSb1) {
                        moreSb1.forEach(p => {
                            const cod = String(p.codigo || '').trim().toUpperCase();
                            if (cod && !knownCodes.has(cod)) {
                                knownCodes.add(cod);
                                const fornInfo = fornecedorByNossoMap[cod] || {};
                                codigosManagerCatalog.push({
                                    codigo: cod,
                                    descricao: p.descricao || '-',
                                    codigo_fornecedor: fornInfo.codigo_fornecedor || '',
                                    codigo_barras: fornInfo.codigo_barras || p.codigo_barras || ''
                                });
                            }
                        });
                    }
                } catch(eCatalog) {
                    console.warn("Aviso catálogo estendido:", eCatalog);
                }
            }

            codigosManagerCatalog.sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));
            if (countInfo) countInfo.innerText = `${codigosManagerCatalog.length} materiais indexados`;
        }

        function syncMgrInput(cod, type, val) {
            if (type === 'forn') {
                const d = document.getElementById(`mgrFornInput_${cod}`);
                const m = document.getElementById(`mgrFornInputMob_${cod}`);
                if (d && d.value !== val) d.value = val;
                if (m && m.value !== val) m.value = val;
            } else {
                const d = document.getElementById(`mgrBarInput_${cod}`);
                const m = document.getElementById(`mgrBarInputMob_${cod}`);
                if (d && d.value !== val) d.value = val;
                if (m && m.value !== val) m.value = val;
            }
        }

        function filterCodigosManagerList() {
            const tbody = document.getElementById('mgrCodigosTableBody');
            const mobileList = document.getElementById('mgrCodigosMobileList');
            const searchInp = document.getElementById('mgrCodigosSearchInput');
            const filterSel = document.getElementById('mgrCodigosStatusFilter');
            const countInfo = document.getElementById('mgrCodigosCountInfo');
            if (!tbody && !mobileList) return;

            const term = searchInp ? searchInp.value.trim().toLowerCase() : '';
            const status = filterSel ? filterSel.value : 'ALL';

            const filtered = (codigosManagerCatalog || []).filter(item => {
                if (status === 'WITH_FORN' && !item.codigo_fornecedor) return false;
                if (status === 'WITHOUT_FORN' && item.codigo_fornecedor) return false;
                if (status === 'WITH_BARCODE' && !item.codigo_barras) return false;
                if (status === 'WITHOUT_BARCODE' && item.codigo_barras) return false;

                if (term) {
                    const mCod = item.codigo.toLowerCase().includes(term);
                    const mDesc = item.descricao.toLowerCase().includes(term);
                    const mForn = (item.codigo_fornecedor || '').toLowerCase().includes(term);
                    const mBar = (item.codigo_barras || '').toLowerCase().includes(term);
                    if (!mCod && !mDesc && !mForn && !mBar) return false;
                }
                return true;
            });

            if (countInfo) {
                countInfo.innerText = `Exibindo ${filtered.length} de ${codigosManagerCatalog.length} materiais`;
            }

            if (filtered.length === 0) {
                if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-8 text-center text-xs text-slate-400 font-bold">Nenhum material localizado com os termos informados.</td></tr>`;
                if (mobileList) mobileList.innerHTML = `<div class="p-6 text-center text-xs font-bold text-slate-400">Nenhum material localizado com os termos informados.</div>`;
                return;
            }

            const displayList = filtered.slice(0, 100);
            let tableHtml = '';
            let mobileHtml = '';

            displayList.forEach(item => {
                const cod = item.codigo;
                // Linha da Tabela Desktop
                tableHtml += `
                    <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                        <td class="px-3 py-2.5 font-mono font-black text-[#002f6c] dark:text-blue-400 whitespace-nowrap">${cod}</td>
                        <td class="px-3 py-2.5 font-bold text-slate-800 dark:text-slate-200">
                            <div class="line-clamp-1" title="${item.descricao}">${item.descricao}</div>
                        </td>
                        <td class="px-3 py-2.5">
                            <input type="text" id="mgrFornInput_${cod}" oninput="syncMgrInput('${cod}', 'forn', this.value)" value="${item.codigo_fornecedor || ''}" placeholder="Cód. Fornecedor" class="w-full min-w-[130px] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-mono font-bold uppercase focus:ring-1 focus:ring-[#002f6c]">
                        </td>
                        <td class="px-3 py-2.5">
                            <div class="flex items-center gap-1">
                                <input type="text" id="mgrBarInput_${cod}" oninput="syncMgrInput('${cod}', 'bar', this.value)" value="${item.codigo_barras || ''}" placeholder="Cód. Barras / QR" class="w-full min-w-[140px] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-mono font-bold uppercase focus:ring-1 focus:ring-purple-500">
                                <button type="button" onclick="scanBarcodeForManagerRow('${cod}')" class="p-1.5 bg-purple-100 hover:bg-purple-200 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 rounded-lg cursor-pointer transition-colors" title="Bipar código com a câmera">
                                    <i data-lucide="scan" class="w-3.5 h-3.5"></i>
                                </button>
                            </div>
                        </td>
                        <td class="px-3 py-2.5 text-center whitespace-nowrap">
                            <button type="button" onclick="saveCodigoRow('${cod}')" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black shadow-2xs transition-all cursor-pointer inline-flex items-center gap-1">
                                <i data-lucide="save" class="w-3 h-3"></i>
                                <span>Salvar</span>
                            </button>
                        </td>
                    </tr>
                `;

                // Card Móvel Vertical (Sem Barra de Rolagem Horizontal)
                mobileHtml += `
                    <div class="bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs space-y-2.5">
                        <div class="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700 pb-2">
                            <span class="px-2.5 py-0.5 rounded-lg text-xs font-mono font-black text-[#002f6c] dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800">
                                ${cod}
                            </span>
                            <button type="button" onclick="saveCodigoRow('${cod}')" class="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-2xs transition-all cursor-pointer inline-flex items-center gap-1.5 touch-active">
                                <i data-lucide="save" class="w-3.5 h-3.5"></i>
                                <span>Salvar</span>
                            </button>
                        </div>
                        <div class="text-xs font-bold text-slate-800 dark:text-slate-200 leading-snug">
                            ${item.descricao}
                        </div>
                        <div class="space-y-2 pt-0.5">
                            <div>
                                <label class="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Cód. Fornecedor</label>
                                <input type="text" id="mgrFornInputMob_${cod}" oninput="syncMgrInput('${cod}', 'forn', this.value)" value="${item.codigo_fornecedor || ''}" placeholder="Informe o código do fornecedor" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold uppercase focus:ring-2 focus:ring-[#002f6c]">
                            </div>
                            <div>
                                <label class="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Cód. Barras / QR Code</label>
                                <div class="flex items-center gap-2">
                                    <input type="text" id="mgrBarInputMob_${cod}" oninput="syncMgrInput('${cod}', 'bar', this.value)" value="${item.codigo_barras || ''}" placeholder="Informe ou bipe o código de barras" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold uppercase focus:ring-2 focus:ring-purple-500">
                                    <button type="button" onclick="scanBarcodeForManagerRow('${cod}')" class="p-2.5 bg-purple-100 hover:bg-purple-200 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 rounded-xl cursor-pointer transition-colors flex-shrink-0 touch-active" title="Bipar código com a câmera">
                                        <i data-lucide="scan" class="w-4 h-4"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });

            if (filtered.length > 100) {
                tableHtml += `<tr><td colspan="5" class="px-4 py-2 text-center text-[10px] text-slate-400 font-bold bg-slate-50/50 dark:bg-slate-800/40">+${filtered.length - 100} outros materiais. Refine sua busca acima para filtrar.</td></tr>`;
                mobileHtml += `<div class="p-3 text-center text-[10px] text-slate-400 font-bold bg-slate-50/50 dark:bg-slate-800/40 rounded-xl">+${filtered.length - 100} outros materiais. Refine sua busca acima.</div>`;
            }

            if (tbody) tbody.innerHTML = tableHtml;
            if (mobileList) mobileList.innerHTML = mobileHtml;
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }

        async function saveCodigoRow(codNosso) {
            const fornInp = document.getElementById(`mgrFornInput_${codNosso}`) || document.getElementById(`mgrFornInputMob_${codNosso}`);
            const barInp = document.getElementById(`mgrBarInput_${codNosso}`) || document.getElementById(`mgrBarInputMob_${codNosso}`);
            if (!fornInp || !barInp) return;

            const newForn = fornInp.value.trim().toUpperCase();
            const newBar = barInp.value.trim().toUpperCase();

            let fornSaved = true;
            let barSaved = true;

            const catItem = codigosManagerCatalog.find(c => c.codigo === codNosso);

            if (newForn !== (catItem ? catItem.codigo_fornecedor : '')) {
                fornSaved = await saveSupplierCodeForProduct(codNosso, newForn);
                if (fornSaved && catItem) catItem.codigo_fornecedor = newForn;
            }

            if (newBar !== (catItem ? catItem.codigo_barras : '')) {
                barSaved = await saveBarcodeForProduct(codNosso, newBar);
                if (barSaved && catItem) catItem.codigo_barras = newBar;
            }

            if (fornSaved && barSaved) {
                showAlert(`Códigos do material ${codNosso} atualizados com sucesso!`, "success");
            }
        }

        function scanBarcodeForManagerRow(codNosso) {
            openCameraScanner((decodedText) => {
                if (!decodedText) return;
                let scanned = String(decodedText).trim();
                if (scanned.startsWith('AMAZON_ACO|')) {
                    const parts = scanned.split('|');
                    if (parts.length >= 4) scanned = parts[3].trim();
                }
                const clean = scanned.toUpperCase();
                const inp = document.getElementById(`mgrBarInput_${codNosso}`);
                const inpMob = document.getElementById(`mgrBarInputMob_${codNosso}`);
                if (inp) inp.value = clean;
                if (inpMob) inpMob.value = clean;
                showAlert(`Código de barras "${clean}" inserido para o material ${codNosso}. Clique em "Salvar" para confirmar!`, "info");
            }, { title: `Bipar Código de Barras para Material ${codNosso}` });
        }

        function scanToFindInCodigosManager() {
            openCameraScanner((decodedText) => {
                if (!decodedText) return;
                let scanned = String(decodedText).trim();
                if (scanned.startsWith('AMAZON_ACO|')) {
                    const parts = scanned.split('|');
                    if (parts.length >= 4) scanned = parts[3].trim();
                }
                const clean = scanned.toUpperCase();
                const searchInp = document.getElementById('mgrCodigosSearchInput');
                if (searchInp) {
                    searchInp.value = clean;
                    filterCodigosManagerList();
                }
                showAlert(`Filtro aplicado para o código bipado: "${clean}"`, "info");
            }, { title: "Bipar para Localizar Material" });
        }

        window.onload = async function() {
            const user = await checkAuth();
            if (!user) return;
            
            await loadValidadeData();
            initValidadeRealtime();

            // Auto-atualização ao reativar aba/janela no PC ou Celular
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden && navigator.onLine) {
                    loadValidadeData(true);
                }
            });
            window.addEventListener('focus', () => {
                if (navigator.onLine) {
                    loadValidadeData(true);
                }
            });

            // Polling de sincronização em segundo plano a cada 20 segundos
            setInterval(() => {
                if (!document.hidden && navigator.onLine) {
                    loadValidadeData(true);
                }
            }, 20000);

            // Verifica query params de filtro (vindo da tela inicial)
            const urlParams = new URLSearchParams(window.location.search);
            const filtroParam = urlParams.get('filtro');
            if (filtroParam) {
                if (filtroParam === 'vencidos') {
                    const sel = document.getElementById('valFilterStatus');
                    if (sel) sel.value = 'VENCIDO';
                } else if (filtroParam === 'vencendo30' || filtroParam === 'vencendo60') {
                    const sel = document.getElementById('valFilterStatus');
                    if (sel) sel.value = 'AVENCER';
                } else if (filtroParam === 'noPrazo') {
                    const sel = document.getElementById('valFilterStatus');
                    if (sel) sel.value = 'OK';
                } else if (filtroParam === 'divergencias') {
                    const sel = document.getElementById('valFilterSaldoConferencia');
                    if (sel) sel.value = 'DIVERGENCIA';
                }
                applyValidadeFilters();
            }

            // Verifica query param "codigo"
            const initialCode = urlParams.get('codigo');
            if (initialCode) {
                openNewValidadeModal(initialCode);
            }
        };
