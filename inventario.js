        let currentSector = 'COMERCIO';
        let rawSb1Dataset = [];
        let rawSaldoDataset = [];
        let rawConfDataset = [];
        let rawValidadeDataset = [];
        let filteredInventoryDataset = [];
        let localCountsMap = {};
        let chartInstances = {};
        
        const ITEMS_PER_PAGE = 50;
        let currentPage = 1;

        let activeCalcArmazemCode = null;
        let searchDebounceTimeout = null;
        let massCountRows = [];

        let knownTagsList = [];
        let knownUnitsList = [];
        let knownFornecedoresList = [];

        let editingTagsProductCode = null;
        let currentProductTagsArray = [];
        let editingFornecedoresProductCode = null;
        let currentProductFornecedoresArray = [];

        function getTargetFilialForSector() {
            if (!currentUser) return '01';
            if (isGlobalFilial(currentUser)) {
                const sel = document.getElementById('invFilterFilial');
                if (sel && sel.value && sel.value !== '00') {
                    return sel.value;
                }
                return 'ALL';
            }
            if (currentSector === 'INDUSTRIA') {
                return String(currentUser.filial_industria || currentUser.filial_atual || '06').trim().padStart(2, '0');
            } else {
                return String(currentUser.filial_comercio || currentUser.filial_atual || '01').trim().padStart(2, '0');
            }
        }

        function initFilialFilterUI() {
            const selFilial = document.getElementById('invFilterFilial');
            if (!selFilial) return;

            const isGlobal = isGlobalFilial(currentUser);
            const userAssigned = (currentSector === 'INDUSTRIA')
                ? String(currentUser ? (currentUser.filial_industria || currentUser.filial_atual || '06') : '06').trim().padStart(2, '0')
                : String(currentUser ? (currentUser.filial_comercio || currentUser.filial_atual || '01') : '01').trim().padStart(2, '0');

            if (isGlobal) {
                selFilial.disabled = false;
                selFilial.className = "bg-white border border-slate-200 text-xs font-bold text-[#002f6c] rounded-xl px-3 py-2 w-full sm:w-48 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#002f6c]";

                let savedFilial = null;
                try { savedFilial = localStorage.getItem('amazon_selected_filial'); } catch(e) {}
                if (savedFilial === '00') savedFilial = 'ALL';

                let currentVal = selFilial.value || savedFilial || 'ALL';
                if (currentVal === '00') currentVal = 'ALL';

                let opts = `<option value="ALL">Todas as Filiais</option>`;
                if (currentSector === 'INDUSTRIA') {
                    const indList = ['01', '02', '03', '04', '05', '06'];
                    indList.forEach(f => {
                        const label = getFilialDisplayName(f, 'industria');
                        opts += `<option value="${f}">${label}</option>`;
                    });
                } else {
                    const comList = getCachedFiliaisList().filter(f => f.num_filial !== '00').map(f => String(f.num_filial).padStart(2, '0'));
                    const allCom = [...new Set(['01', '02', '04', '05', '06', '12', ...comList])].sort((a,b) => parseInt(a,10) - parseInt(b,10));
                    allCom.forEach(f => {
                        const label = getFilialDisplayName(f, 'comercio');
                        opts += `<option value="${f}">${label}</option>`;
                    });
                }
                selFilial.innerHTML = opts;
                selFilial.value = currentVal;
                if (!selFilial.value) {
                    selFilial.value = 'ALL';
                }
            } else {
                selFilial.disabled = true;
                selFilial.className = "bg-slate-100 border border-slate-200 text-xs font-bold text-[#002f6c] rounded-xl px-3 py-2 w-full sm:w-48 cursor-not-allowed opacity-80";
                const label = getFilialDisplayName(userAssigned, currentSector === 'INDUSTRIA' ? 'industria' : 'comercio');
                selFilial.innerHTML = `<option value="${userAssigned}" selected>${label}</option>`;
                selFilial.value = userAssigned;
            }
        }

        function onFilialFilterChange() {
            const selFilial = document.getElementById('invFilterFilial');
            if (selFilial) {
                let val = selFilial.value || 'ALL';
                if (val === '00') val = 'ALL';
                try { localStorage.setItem('amazon_selected_filial', val); } catch(e) {}
            }
            extractInventoryMetadata();
            applyInventoryFilters(true);
        }

        function switchSector(sector) {
            currentSector = sector;
            const btnC = document.getElementById('btnSectorComercio');
            const btnI = document.getElementById('btnSectorIndustria');

            if (sector === 'COMERCIO') {
                if (btnC) btnC.className = "px-4 py-2 rounded-xl text-xs font-black transition-all bg-[#002f6c] text-white shadow-sm flex items-center gap-1.5";
                if (btnI) btnI.className = "px-4 py-2 rounded-xl text-xs font-black transition-all text-slate-600 hover:text-slate-900 flex items-center gap-1.5";
            } else {
                if (btnC) btnC.className = "px-4 py-2 rounded-xl text-xs font-black transition-all text-slate-600 hover:text-slate-900 flex items-center gap-1.5";
                if (btnI) btnI.className = "px-4 py-2 rounded-xl text-xs font-black transition-all bg-[#002f6c] text-white shadow-sm flex items-center gap-1.5";
            }

            initFilialFilterUI();

            localCountsMap = {};
            currentPage = 1;
            loadInventoryData();
            initInventoryRealtime();
        }

        function handleSearchDebounce() {
            if (searchDebounceTimeout) clearTimeout(searchDebounceTimeout);
            searchDebounceTimeout = setTimeout(() => {
                applyInventoryFilters(true);
            }, 250);
        }

        function formatAnoMesDisplay(anoMesStr) {
            if (!anoMesStr || !/^\d{4}-\d{2}$/.test(anoMesStr)) return '-';
            const [ano, mes] = anoMesStr.split('-');
            const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
            const idx = parseInt(mes, 10) - 1;
            return `${meses[idx] || mes}/${ano}`;
        }

        function getProductValidadeForArmazem(codigo, armazem, filial = null) {
            const fil = filial || (currentUser ? String(currentUser.filial_atual).padStart(2, '0') : '01');
            const arm = String(armazem).trim().padStart(2, '0');
            const matches = rawValidadeDataset.filter(v => 
                String(v.produto).trim() === codigo && 
                String(v.armazem).trim().padStart(2, '0') === arm && 
                (String(v.filial).trim().padStart(2, '0') === fil || fil === 'ALL')
            );
            matches.sort((a,b) => (a.data_validade || '').localeCompare(b.data_validade || ''));
            return matches[0] || null;
        }

        async function loadInventoryData(silent = false) {
            if (!supabaseClient) return;
            const loader = document.getElementById('globalLoader');
            if (loader && !silent) loader.classList.remove('hidden');

            const refreshBtnIcon = document.querySelector('#btnRefreshInventory i');
            if (refreshBtnIcon) refreshBtnIcon.classList.add('animate-spin');

            try {
                const sb1Table = currentSector === 'INDUSTRIA' ? 'sb1_industria' : 'sb1_comercio';
                const saldoTable = currentSector === 'INDUSTRIA' ? 'saldo_industria' : 'saldo_comercio';
                const contagemTable = currentSector === 'INDUSTRIA' ? 'contagem_industria' : 'contagem_comercio';
                const valTable = currentSector === 'INDUSTRIA' ? 'validade_industria' : 'validade_comercio';

                const isGlobal = isGlobalFilial(currentUser);
                const userFilial = isGlobal ? 'ALL' : getTargetFilialForSector();

                // 1. Carrega Saldos
                let saldoAll = [];
                let from2 = 0, step2 = 1000, fetchMore2 = true;
                while (fetchMore2) {
                    let query = supabaseClient.from(saldoTable).select('produto, filial, armazem, quantidade, endereco, custo_unitario');
                    if (!isGlobal && userFilial && userFilial !== 'ALL' && userFilial !== '00') {
                        query = query.eq('filial', userFilial);
                    }
                    const { data, error } = await query.range(from2, from2 + step2 - 1);
                    if (error || !data || data.length === 0) { fetchMore2 = false; } 
                    else {
                        saldoAll = saldoAll.concat(data);
                        if (data.length < step2) fetchMore2 = false; else from2 += step2;
                    }
                }

                // 2. Carrega Contagens
                let confAll = [];
                try {
                    let from3 = 0, step3 = 1000, fetchMore3 = true;
                    while (fetchMore3) {
                        let query = supabaseClient.from(contagemTable).select('*');
                        if (!isGlobal && userFilial && userFilial !== 'ALL' && userFilial !== '00') {
                            query = query.eq('filial', userFilial);
                        }
                        const { data, error } = await query.range(from3, from3 + step3 - 1);
                        if (error) {
                            fetchMore3 = false;
                        } else if (data && data.length > 0) {
                            const mapped = data.map(d => ({
                                created_at: d.created_at,
                                produto: String(d.produto).trim(),
                                filial: String(d.filial || '01').trim().padStart(2, '0'),
                                armazem: String(d.armazem_contagem || d.armazem || '01').trim().padStart(2, '0'),
                                qtd_contada: Number(d.quantidade_contada !== undefined ? d.quantidade_contada : (d.qtd_contada || 0)),
                                conferente_nome: d.quem_contou || d.conferente_nome || 'SISTEMA',
                                observacao: d.observacao || ''
                            }));
                            confAll = confAll.concat(mapped);
                            if (data.length < step3) fetchMore3 = false; else from3 += step3;
                        } else {
                            fetchMore3 = false;
                        }
                    }
                    
                    if (confAll.length === 0 && currentSector === 'COMERCIO') {
                        let from4 = 0, fetchMore4 = true;
                        while (fetchMore4) {
                            let query = supabaseClient.from('conferencia_comercio').select('*');
                            if (!isGlobal && userFilial && userFilial !== 'ALL' && userFilial !== '00') {
                                query = query.eq('filial', userFilial);
                            }
                            const fallbackRes = await query.range(from4, from4 + step3 - 1);
                            if (!fallbackRes.error && fallbackRes.data && fallbackRes.data.length > 0) {
                                confAll = confAll.concat(fallbackRes.data.map(d => ({
                                    created_at: d.created_at,
                                    produto: String(d.produto).trim(),
                                    filial: String(d.filial || '01').trim().padStart(2, '0'),
                                    armazem: String(d.armazem || '01').trim().padStart(2, '0'),
                                    qtd_contada: Number(d.qtd_contada || 0),
                                    conferente_nome: d.conferente_nome || 'SISTEMA',
                                    observacao: d.observacao || ''
                                })));
                                if (fallbackRes.data.length < step3) fetchMore4 = false; else from4 += step3;
                            } else {
                                fetchMore4 = false;
                            }
                        }
                    }
                } catch (eConf) {
                    console.warn("Tabela de contagem não consultada:", eConf);
                }

                // 3. Carrega Validades para preencher o modal de contagem
                let valAll = [];
                try {
                    let fromV = 0, stepV = 1000, fetchMoreV = true;
                    while (fetchMoreV) {
                        let query = supabaseClient.from(valTable).select('*');
                        if (!isGlobal && userFilial && userFilial !== 'ALL' && userFilial !== '00') {
                            query = query.eq('filial', userFilial);
                        }
                        const { data, error } = await query.range(fromV, fromV + stepV - 1);
                        if (error || !data || data.length === 0) { fetchMoreV = false; }
                        else { valAll = valAll.concat(data); if (data.length < stepV) fetchMoreV = false; else fromV += stepV; }
                    }
                } catch(eVal) { console.warn("Erro validades:", eVal); }

                // 4. Carrega Catálogo Completo do SB1 em paralelo ultra-rápido (garante busca e exibição de itens com saldo 0)
                let sb1All = [];
                try {
                    const { count: totalSb1 } = await supabaseClient.from(sb1Table).select('codigo', { count: 'exact', head: true });
                    const totalRows = totalSb1 || 14000;
                    const chunkSize = 1000;
                    const totalChunks = Math.ceil(totalRows / chunkSize);
                    const sb1Promises = [];
                    for (let i = 0; i < totalChunks; i++) {
                        const fromIdx = i * chunkSize;
                        sb1Promises.push(
                            supabaseClient.from(sb1Table)
                                .select('codigo, descricao, unidade, fator_conv, tags, fornecedores, endereco')
                                .range(fromIdx, fromIdx + chunkSize - 1)
                                .then(res => res.data || [])
                        );
                    }
                    const results = await Promise.all(sb1Promises);
                    sb1All = results.flat();
                } catch (errSb1) {
                    console.warn("Aviso ao carregar catálogo completo, usando fallback por códigos ativos:", errSb1);
                    const activeCodesSet = new Set([
                        ...saldoAll.map(s => String(s.produto).trim()),
                        ...confAll.map(c => String(c.produto).trim()),
                        ...valAll.map(v => String(v.produto).trim())
                    ]);
                    const activeCodes = Array.from(activeCodesSet).filter(Boolean);
                    if (activeCodes.length > 0) {
                        for (let i = 0; i < activeCodes.length; i += 500) {
                            const chunk = activeCodes.slice(i, i + 500);
                            const { data } = await supabaseClient.from(sb1Table)
                                .select('codigo, descricao, unidade, fator_conv, tags, fornecedores, endereco')
                                .in('codigo', chunk);
                            if (data) sb1All = sb1All.concat(data);
                        }
                    }
                }

                // DEDUPLICAR CONTAGENS
                const latestMap = {};
                confAll.forEach(c => {
                    const key = `${c.filial}_${c.armazem}_${c.produto}`;
                    if (!latestMap[key] || new Date(c.created_at) > new Date(latestMap[key].created_at)) {
                        latestMap[key] = c;
                    }
                });

                // DEDUPLICAR SB1
                const uniqueSb1Map = {};
                sb1All.forEach(p => {
                    const cod = String(p.codigo || p.Codigo || '').trim();
                    if (!cod) return;
                    const desc = String(p.descricao || p['Descr.Espec.'] || 'SEM DESCRIÇÃO').trim();
                    const um = String(p.unidade || p.Unidade || 'PC').trim();
                    const fc = p.fator_conv !== undefined ? Number(p.fator_conv) : (p['Fator Conv.'] !== undefined ? Number(p['Fator Conv.']) : 1);
                    const tg = p.tags || '';
                    const forn = p.fornecedores || '';
                    const endr = p.endereco || p.Endereco || '';

                    if (!uniqueSb1Map[cod]) {
                        uniqueSb1Map[cod] = {
                            codigo: cod,
                            Codigo: cod,
                            descricao: desc,
                            'Descr.Espec.': desc,
                            unidade: um,
                            Unidade: um,
                            fator_conv: fc,
                            'Fator Conv.': fc,
                            fatorConv: fc,
                            tags: tg,
                            fornecedores: forn,
                            endereco: endr,
                            Endereco: endr
                        };
                    }
                });
                rawSb1Dataset = Object.values(uniqueSb1Map);
                
                rawSaldoDataset = saldoAll.map(s => {
                    const rawFil = s.filial !== undefined && s.filial !== null ? String(s.filial).trim() : '01';
                    const rawArm = s.armazem !== undefined && s.armazem !== null ? String(s.armazem).trim() : '01';
                    return {
                        ...s,
                        produto: String(s.produto).trim(),
                        filial: rawFil.padStart(2, '0'),
                        armazem: rawArm.padStart(2, '0'),
                        quantidade: parseFloat(s.quantidade || 0),
                        endereco: s.endereco || ''
                    };
                });

                rawConfDataset = Object.values(latestMap).map(c => {
                    const rawFil = c.filial !== undefined && c.filial !== null ? String(c.filial).trim() : '01';
                    const rawArm = c.armazem !== undefined && c.armazem !== null ? String(c.armazem).trim() : '01';
                    return {
                        ...c,
                        produto: String(c.produto).trim(),
                        filial: rawFil.padStart(2, '0'),
                        armazem: rawArm.padStart(2, '0'),
                        observacao: c.observacao || ''
                    };
                });

                rawValidadeDataset = valAll.map(v => ({
                    ...v,
                    produto: String(v.produto || '').trim(),
                    filial: String(v.filial || '01').trim().padStart(2, '0'),
                    armazem: String(v.armazem || '01').trim().padStart(2, '0')
                }));

                extractInventoryMetadata();
                applyInventoryFilters();
            } catch (err) {
                console.error("Erro ao carregar inventário:", err);
                showAlert("Falha ao carregar dados do inventário.", "warning");
            } finally {
                if (loader && !silent) loader.classList.add('hidden');
                if (refreshBtnIcon) refreshBtnIcon.classList.remove('animate-spin');
            }
        }

        function restoreInventoryFiltersFromLocalStorage() {
            try {
                const savedStatuses = localStorage.getItem('amazon_selected_statuses');
                if (savedStatuses) {
                    const parsed = JSON.parse(savedStatuses);
                    if (Array.isArray(parsed)) {
                        document.querySelectorAll('.status-checkbox').forEach(cb => {
                            cb.checked = parsed.includes(cb.value);
                        });
                    }
                }
            } catch (e) {}

            try {
                const savedExclude = localStorage.getItem('amazon_tag_exclude_mode');
                const cbExclude = document.getElementById('invTagExcludeMode');
                if (savedExclude !== null && cbExclude) {
                    cbExclude.checked = (savedExclude === 'true');
                }
            } catch (e) {}

            try {
                const savedMode = localStorage.getItem('amazon_saldo_filter_mode');
                const selMode = document.getElementById('invSaldoFilterMode');
                if (savedMode && selMode) {
                    selMode.value = savedMode;
                }
            } catch (e) {}

            try {
                const savedSearch = localStorage.getItem('amazon_inv_search');
                const inputSearch = document.getElementById('invSearch');
                if (savedSearch !== null && inputSearch) {
                    inputSearch.value = savedSearch;
                }
            } catch (e) {}

            try {
                const savedForn = localStorage.getItem('amazon_selected_fornecedores');
                if (savedForn) {
                    const parsed = JSON.parse(savedForn);
                    if (Array.isArray(parsed)) {
                        document.querySelectorAll('.fornecedor-checkbox').forEach(cb => {
                            cb.checked = parsed.includes(cb.value.toLowerCase());
                        });
                    }
                }
            } catch (e) {}

            try {
                const savedExcludeForn = localStorage.getItem('amazon_fornecedor_exclude_mode');
                const cbExcludeForn = document.getElementById('invFornecedorExcludeMode');
                if (savedExcludeForn !== null && cbExcludeForn) {
                    cbExcludeForn.checked = (savedExcludeForn === 'true');
                }
            } catch (e) {}
        }

        function extractInventoryMetadata() {
            initFilialFilterUI();

            const selFilial = document.getElementById('invFilterFilial');
            const isGlobal = isGlobalFilial(currentUser);
            const userAssigned = getTargetFilialForSector();

            let selectedFilial = (isGlobal && selFilial) ? (selFilial.value || 'ALL') : userAssigned;
            if (selectedFilial === '00') selectedFilial = 'ALL';

            const isFilialMatch = (itemFilial, filterFilial) => {
                if (!filterFilial || filterFilial === 'ALL' || filterFilial === '00' || filterFilial === 'TODAS') return true;
                const fPad = String(itemFilial || '01').trim().padStart(2, '0');
                const fRaw = fPad.replace(/^0+/, '') || '0';
                const targetPad = String(filterFilial).trim().padStart(2, '0');
                const targetRaw = targetPad.replace(/^0+/, '') || '0';
                return fPad === targetPad || fRaw === targetRaw;
            };

            const targetSaldos = (selectedFilial === 'ALL') 
                ? rawSaldoDataset 
                : rawSaldoDataset.filter(s => isFilialMatch(s.filial, selectedFilial));

            const armazens = [...new Set(targetSaldos.map(s => s.armazem ? String(s.armazem).trim().padStart(2, '0') : '').filter(a => a && a.length <= 4))].sort((a,b) => {
                const numA = parseInt(a, 10);
                const numB = parseInt(b, 10);
                if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                return a.localeCompare(b);
            });

            const container = document.getElementById('armazemCheckboxesContainer');
            if (container) {
                let savedArmazenSelection = null;
                try {
                    const saved = localStorage.getItem('amazon_selected_armazens');
                    if (saved) {
                        const parsed = JSON.parse(saved);
                        if (Array.isArray(parsed)) {
                            savedArmazenSelection = parsed.filter(a => String(a).length <= 4);
                        }
                    }
                } catch(e) {}

                let html = '';
                armazens.forEach(a => {
                    const isChecked = savedArmazenSelection ? savedArmazenSelection.includes(a) : true;
                    html += `
                        <label class="flex items-center space-x-2.5 p-1.5 hover:bg-slate-50 rounded-xl cursor-pointer select-none">
                            <input type="checkbox" value="${a}" ${isChecked ? 'checked' : ''} onchange="applyInventoryFilters(true)" class="armazem-checkbox w-4 h-4 text-[#002f6c] rounded border-slate-300 focus:ring-[#002f6c]">
                            <span class="text-xs font-bold text-slate-700">Armazém ${a}</span>
                        </label>
                    `;
                });
                container.innerHTML = html;
            }

            const tagsSet = new Set();
            const unitsSet = new Set();
            const fornecedoresSet = new Set();
            rawSb1Dataset.forEach(p => {
                if (p.Unidade) unitsSet.add(String(p.Unidade).trim().toUpperCase());
                if (p.tags) {
                    p.tags.split(',').forEach(t => {
                        const trimmed = t.trim().toLowerCase();
                        if (trimmed) tagsSet.add(trimmed);
                    });
                }
                if (p.fornecedores) {
                    const separators = /,|;/;
                    String(p.fornecedores).split(separators).forEach(f => {
                        const trimmed = f.trim();
                        if (trimmed) fornecedoresSet.add(trimmed);
                    });
                }
            });

            knownTagsList = Array.from(tagsSet).sort();
            knownUnitsList = Array.from(unitsSet).sort();
            knownFornecedoresList = Array.from(fornecedoresSet).sort();

            const containerTags = document.getElementById('tagCheckboxesContainer');
            if (containerTags) {
                let savedTagSelection = null;
                try {
                    const saved = localStorage.getItem('amazon_selected_tags');
                    if (saved) savedTagSelection = JSON.parse(saved);
                } catch(e) {}

                let html = '';
                const isNoTagChecked = (Array.isArray(savedTagSelection) && savedTagSelection.includes('__no_tag__'));
                html += `
                    <label class="flex items-center space-x-2.5 p-1.5 hover:bg-amber-50/50 rounded-xl cursor-pointer select-none border-b border-slate-100 mb-1 pb-2">
                        <input type="checkbox" value="__no_tag__" ${isNoTagChecked ? 'checked' : ''} onchange="applyInventoryFilters(true)" class="tag-checkbox w-4 h-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500">
                        <span class="text-xs font-black text-amber-800">⚪ Materiais Sem Tag</span>
                    </label>
                `;

                if (knownTagsList.length > 0) {
                    knownTagsList.forEach(t => {
                        const isChecked = (Array.isArray(savedTagSelection) && savedTagSelection.includes(t));
                        html += `
                            <label class="flex items-center space-x-2.5 p-1.5 hover:bg-slate-50 rounded-xl cursor-pointer select-none">
                                <input type="checkbox" value="${t}" ${isChecked ? 'checked' : ''} onchange="applyInventoryFilters(true)" class="tag-checkbox w-4 h-4 text-[#002f6c] rounded border-slate-300 focus:ring-[#002f6c]">
                                <span class="text-xs font-bold text-slate-700">${t}</span>
                            </label>
                        `;
                    });
                }
                containerTags.innerHTML = html;
            }

            const containerForn = document.getElementById('fornecedorCheckboxesContainer');
            if (containerForn) {
                let savedFornSelection = null;
                try {
                    const saved = localStorage.getItem('amazon_selected_fornecedores');
                    if (saved) savedFornSelection = JSON.parse(saved);
                } catch(e) {}

                let html = '';
                const isNoFornChecked = (Array.isArray(savedFornSelection) && savedFornSelection.includes('__no_forn__'));
                html += `
                    <label class="flex items-center space-x-2.5 p-1.5 hover:bg-amber-50/50 rounded-xl cursor-pointer select-none border-b border-slate-100 mb-1 pb-2">
                        <input type="checkbox" value="__no_forn__" ${isNoFornChecked ? 'checked' : ''} onchange="applyInventoryFilters(true)" class="fornecedor-checkbox w-4 h-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500">
                        <span class="text-xs font-black text-amber-800">⚪ Materiais Sem Fornecedor</span>
                    </label>
                `;

                if (knownFornecedoresList.length > 0) {
                    knownFornecedoresList.forEach(f => {
                        const isChecked = (Array.isArray(savedFornSelection) && savedFornSelection.includes(f.toLowerCase()));
                        html += `
                            <label class="flex items-center space-x-2.5 p-1.5 hover:bg-slate-50 rounded-xl cursor-pointer select-none" title="${f}">
                                <input type="checkbox" value="${f}" ${isChecked ? 'checked' : ''} onchange="applyInventoryFilters(true)" class="fornecedor-checkbox w-4 h-4 text-[#002f6c] rounded border-slate-300 focus:ring-[#002f6c]">
                                <span class="text-xs font-bold text-slate-700 truncate max-w-[200px]">${f}</span>
                            </label>
                        `;
                    });
                }
                containerForn.innerHTML = html;
            }

            restoreInventoryFiltersFromLocalStorage();
        }

        function toggleArmazemDropdown(e) {
            if (e) e.stopPropagation();
            const menu = document.getElementById('armazemDropdownMenu');
            if (menu) menu.classList.toggle('hidden');
        }

        function selectAllArmazens(select) {
            const checkboxes = document.querySelectorAll('.armazem-checkbox');
            checkboxes.forEach(cb => cb.checked = select);
            applyInventoryFilters(true);
        }

        function toggleStatusDropdown(e) {
            if (e) e.stopPropagation();
            const menu = document.getElementById('statusDropdownMenu');
            if (menu) menu.classList.toggle('hidden');
        }

        function selectAllStatus(select) {
            const checkboxes = document.querySelectorAll('.status-checkbox');
            checkboxes.forEach(cb => cb.checked = select);
            applyInventoryFilters(true);
        }

        function toggleTagDropdown(e) {
            if (e) e.stopPropagation();
            const menu = document.getElementById('tagDropdownMenu');
            if (menu) menu.classList.toggle('hidden');
        }

        function selectAllTags(select) {
            const checkboxes = document.querySelectorAll('.tag-checkbox');
            checkboxes.forEach(cb => cb.checked = select);
            applyInventoryFilters(true);
        }

        function toggleFornecedorDropdown(e) {
            if (e) e.stopPropagation();
            const menu = document.getElementById('fornecedorDropdownMenu');
            if (menu) menu.classList.toggle('hidden');
        }

        function selectAllFornecedores(select) {
            const checkboxes = document.querySelectorAll('.fornecedor-checkbox');
            checkboxes.forEach(cb => cb.checked = select);
            applyInventoryFilters(true);
        }

        function scanBarcodeForInventario() {
            openCameraScanner((decodedText) => {
                if (!decodedText) return;
                let scanned = String(decodedText).trim();
                
                // Se for QR Code estruturado de Palete (AMAZON_ACO|filial|armazem|produto|lote)
                if (scanned.startsWith('AMAZON_ACO|')) {
                    const parts = scanned.split('|');
                    if (parts.length >= 4) {
                        scanned = parts[3].trim();
                    }
                }

                const normCode = typeof normalizeProductCode === 'function' ? normalizeProductCode(scanned) : scanned;
                const cleanCode = normCode.toUpperCase();
                
                // 1. Procura no catálogo SB1 ou no inventário carregado
                let match = (typeof rawSb1Dataset !== 'undefined' && Array.isArray(rawSb1Dataset))
                    ? rawSb1Dataset.find(item => String(item.codigo || item.Codigo).trim().toUpperCase() === cleanCode || String(item.codigo || item.Codigo).trim().toUpperCase() === scanned.toUpperCase())
                    : null;

                if (!match && typeof filteredInventoryDataset !== 'undefined' && Array.isArray(filteredInventoryDataset)) {
                    match = filteredInventoryDataset.find(item => String(item.codigo).trim().toUpperCase() === cleanCode);
                }

                if (match) {
                    const desc = match.descricao || match['Descr.Espec.'] || cleanCode;
                    showAlert(`Material identificado: ${cleanCode} - ${desc}`, "success");
                    openCountModal(cleanCode, desc);
                } else {
                    showAlert(`Material bipado: ${cleanCode}. Abrindo contagem...`, "info");
                    openCountModal(cleanCode, cleanCode);
                }
            }, { title: "Bipar Material / Inventário" });
        }

        let isDailyGoalFilterActive = false;
        let isRouteSortActive = false;

        function toggleDailyGoalFilter() {
            isDailyGoalFilterActive = !isDailyGoalFilterActive;
            const btn = document.getElementById('btnFilterDailyGoal');
            const textEl = document.getElementById('btnFilterDailyGoalText');
            if (isDailyGoalFilterActive) {
                if (btn) {
                    btn.classList.remove('bg-amber-400', 'text-slate-950');
                    btn.classList.add('bg-emerald-400', 'text-slate-950');
                }
                if (textEl) textEl.innerText = "✓ Exibindo Sugestões (Clique p/ Todos)";
                showAlert("Filtrando apenas itens sugeridos para a meta de hoje.", "info");
            } else {
                if (btn) {
                    btn.classList.remove('bg-emerald-400');
                    btn.classList.add('bg-amber-400', 'text-slate-950');
                }
                if (textEl) textEl.innerText = "🎯 Focar na Meta do Dia";
            }
            applyInventoryFilters(true);
        }

        function toggleRouteSortOrder() {
            isRouteSortActive = !isRouteSortActive;
            const btn = document.getElementById('btnToggleRouteSort');
            const textEl = document.getElementById('btnToggleRouteSortText');
            if (isRouteSortActive) {
                if (btn) {
                    btn.classList.remove('bg-white/10', 'text-white');
                    btn.classList.add('bg-amber-400', 'text-slate-950', 'font-black');
                }
                if (textEl) textEl.innerText = "📍 Rota Ativa (Corredor)";
                showAlert("Lista ordenada pela rota física de corredores/endereços do armazém.", "success");
            } else {
                if (btn) {
                    btn.classList.remove('bg-amber-400', 'text-slate-950', 'font-black');
                    btn.classList.add('bg-white/10', 'text-white');
                }
                if (textEl) textEl.innerText = "Rota Física (Galpão)";
            }
            applyInventoryFilters(true);
        }

        function applyInventoryFilters(resetPage = false) {
            const rawSearchVal = document.getElementById('invSearch') ? document.getElementById('invSearch').value : '';
            const term = rawSearchVal.toLowerCase().trim();
            try { localStorage.setItem('amazon_inv_search', rawSearchVal); } catch(e) {}

            const selectedStatuses = [];
            document.querySelectorAll('.status-checkbox:checked').forEach(cb => selectedStatuses.push(cb.value));
            if (document.querySelectorAll('.status-checkbox').length > 0) {
                try { localStorage.setItem('amazon_selected_statuses', JSON.stringify(selectedStatuses)); } catch(e) {}
            }

            const btnLabelStatus = document.getElementById('statusDropdownLabel');
            if (btnLabelStatus) {
                if (selectedStatuses.length === 4) btnLabelStatus.innerText = "Todos os Status";
                else if (selectedStatuses.length === 0) btnLabelStatus.innerText = "Nenhum selecionado";
                else btnLabelStatus.innerText = `${selectedStatuses.length} selecionado(s)`;
            }

            const selectedArmazens = [];
            const allArmazensCBs = document.querySelectorAll('.armazem-checkbox');
            allArmazensCBs.forEach(cb => { if (cb.checked) selectedArmazens.push(cb.value); });
            
            if (allArmazensCBs.length > 0) {
                try {
                    localStorage.setItem('amazon_selected_armazens', JSON.stringify(selectedArmazens));
                } catch(e) {}
            }

            const btnLabelArmazem = document.getElementById('armazemDropdownLabel');
            if (btnLabelArmazem) {
                const totalArmazens = allArmazensCBs.length;
                if (selectedArmazens.length === totalArmazens && totalArmazens > 0) btnLabelArmazem.innerText = "Todos";
                else if (selectedArmazens.length === 0) btnLabelArmazem.innerText = "Nenhum selecionado";
                else btnLabelArmazem.innerText = `${selectedArmazens.length} armazém(ns)`;
            }

            const selectedTags = [];
            const allTagCBs = document.querySelectorAll('.tag-checkbox');
            allTagCBs.forEach(cb => { if (cb.checked) selectedTags.push(cb.value.toLowerCase()); });
            
            if (allTagCBs.length > 0) {
                try {
                    localStorage.setItem('amazon_selected_tags', JSON.stringify(selectedTags));
                } catch(e) {}
            }

            const isExcludeTagMode = document.getElementById('invTagExcludeMode') ? document.getElementById('invTagExcludeMode').checked : false;
            try { localStorage.setItem('amazon_tag_exclude_mode', String(isExcludeTagMode)); } catch(e) {}

            const btnLabelTag = document.getElementById('tagDropdownLabel');
            const btnTagDropdown = document.getElementById('tagDropdownBtn');

            if (btnLabelTag) {
                if (selectedTags.length === 0) {
                    btnLabelTag.innerText = "Todas as Tags";
                } else if (selectedTags.length === 1 && selectedTags[0] === '__no_tag__') {
                    btnLabelTag.innerText = isExcludeTagMode ? "Excluindo Sem Tag" : "Apenas Sem Tag";
                } else {
                    btnLabelTag.innerText = isExcludeTagMode ? `Excluindo ${selectedTags.length} tag(s)` : `${selectedTags.length} tag(s) selecionada(s)`;
                }
            }

            if (btnTagDropdown) {
                if (isExcludeTagMode) {
                    btnTagDropdown.classList.add('border-rose-300', 'bg-rose-50', 'text-rose-900');
                    btnTagDropdown.classList.remove('border-slate-200', 'bg-slate-50', 'text-slate-800');
                } else {
                    btnTagDropdown.classList.remove('border-rose-300', 'bg-rose-50', 'text-rose-900');
                    btnTagDropdown.classList.add('border-slate-200', 'bg-slate-50', 'text-slate-800');
                }
            }

            const selectedFornecedores = [];
            const allFornCBs = document.querySelectorAll('.fornecedor-checkbox');
            allFornCBs.forEach(cb => { if (cb.checked) selectedFornecedores.push(cb.value.toLowerCase()); });
            
            if (allFornCBs.length > 0) {
                try {
                    localStorage.setItem('amazon_selected_fornecedores', JSON.stringify(selectedFornecedores));
                } catch(e) {}
            }

            const isExcludeFornMode = document.getElementById('invFornecedorExcludeMode') ? document.getElementById('invFornecedorExcludeMode').checked : false;
            try { localStorage.setItem('amazon_fornecedor_exclude_mode', String(isExcludeFornMode)); } catch(e) {}

            const btnLabelForn = document.getElementById('fornecedorDropdownLabel');
            const btnFornDropdown = document.getElementById('fornecedorDropdownBtn');

            if (btnLabelForn) {
                if (selectedFornecedores.length === 0) {
                    btnLabelForn.innerText = "Todos os Fornecedores";
                } else if (selectedFornecedores.length === 1 && selectedFornecedores[0] === '__no_forn__') {
                    btnLabelForn.innerText = isExcludeFornMode ? "Excluindo Sem Fornecedor" : "Apenas Sem Fornecedor";
                } else {
                    btnLabelForn.innerText = isExcludeFornMode ? `Excluindo ${selectedFornecedores.length} forn.` : `${selectedFornecedores.length} forn. selecionado(s)`;
                }
            }

            if (btnFornDropdown) {
                if (isExcludeFornMode) {
                    btnFornDropdown.classList.add('border-rose-300', 'bg-rose-50', 'text-rose-900');
                    btnFornDropdown.classList.remove('border-slate-200', 'bg-slate-50', 'text-slate-800');
                } else {
                    btnFornDropdown.classList.remove('border-rose-300', 'bg-rose-50', 'text-rose-900');
                    btnFornDropdown.classList.add('border-slate-200', 'bg-slate-50', 'text-slate-800');
                }
            }

            const selSaldoEl = document.getElementById('invSaldoFilterMode');
            const saldoFilterMode = selSaldoEl ? selSaldoEl.value : (document.getElementById('invShowZeroSaldo')?.checked ? 'SALDO_ZERO' : 'COM_SALDO');
            try { localStorage.setItem('amazon_saldo_filter_mode', saldoFilterMode); } catch(e) {}

            const selFilial = document.getElementById('invFilterFilial');
            let selectedFilial = (isGlobalFilial(currentUser) && selFilial) ? (selFilial.value || 'ALL') : getTargetFilialForSector();
            if (selectedFilial === '00') selectedFilial = 'ALL';
            if (selFilial && selFilial.value) {
                try { localStorage.setItem('amazon_selected_filial', selFilial.value); } catch(e) {}
            }

            const isFilialMatch = (itemFilial, filterFilial) => {
                if (!filterFilial || filterFilial === 'ALL' || filterFilial === '00' || filterFilial === 'TODAS') return true;
                const fPad = String(itemFilial || '01').trim().padStart(2, '0');
                const fRaw = fPad.replace(/^0+/, '') || '0';
                const targetPad = String(filterFilial).trim().padStart(2, '0');
                const targetRaw = targetPad.replace(/^0+/, '') || '0';
                return fPad === targetPad || fRaw === targetRaw;
            };

            const isArmSelectedCheck = (rawArm) => {
                const arm = String(rawArm || '01').trim();
                const armPad = arm.padStart(2, '0');
                const armRaw = arm.replace(/^0+/, '') || '0';
                return selectedArmazens.includes(arm) || selectedArmazens.includes(armPad) || selectedArmazens.includes(armRaw);
            };

            const saldoMap = {};
            rawSaldoDataset.forEach(s => {
                if (!isFilialMatch(s.filial, selectedFilial)) return;
                if (!isArmSelectedCheck(s.armazem)) return;
                const cod = s.produto ? String(s.produto).trim() : '';
                saldoMap[cod] = (saldoMap[cod] || 0) + (s.quantidade || 0);
            });

            const productCountsMap = {};
            const hasCountMap = {};
            const productLastDateMap = {};
            const productLastObsMap = {};

            rawConfDataset.forEach(c => {
                if (!isFilialMatch(c.filial, selectedFilial)) return;
                const arm = String(c.armazem || '01').trim().padStart(2, '0');
                if (!isArmSelectedCheck(arm)) return;
                
                const cod = String(c.produto).trim();
                if (localCountsMap[`${arm}_${cod}`] !== undefined) return;
                
                productCountsMap[cod] = (productCountsMap[cod] || 0) + Number(c.quantidade_contada !== undefined ? c.quantidade_contada : (c.qtd_contada || 0));
                hasCountMap[cod] = true;

                if (c.observacao && !productLastObsMap[cod]) {
                    productLastObsMap[cod] = c.observacao;
                }

                if (c.created_at) {
                    const dt = new Date(c.created_at);
                    if (!isNaN(dt.getTime())) {
                        if (!productLastDateMap[cod] || dt > productLastDateMap[cod]) {
                            productLastDateMap[cod] = dt;
                            if (c.observacao) productLastObsMap[cod] = c.observacao;
                        }
                    }
                }
            });

            Object.keys(localCountsMap).forEach(key => {
                const [armRaw, cod] = key.split('_');
                const arm = armRaw.padStart(2, '0');
                if (!selectedArmazens.includes(arm)) return;
                
                productCountsMap[cod] = (productCountsMap[cod] || 0) + Number(localCountsMap[key] || 0);
                hasCountMap[cod] = true;
                productLastDateMap[cod] = new Date();
            });

            const allMapped = rawSb1Dataset.map(prod => {
                const cod = prod.codigo || prod.Codigo ? String(prod.codigo || prod.Codigo).trim() : '';
                const sysQty = saldoMap[cod] || 0;
                
                const hasCount = hasCountMap[cod] === true;
                let countedQty = null;
                let diff = 0;
                let status = 'PENDENTE';

                if (hasCount) {
                    countedQty = productCountsMap[cod] || 0;
                    diff = countedQty - sysQty;
                    if (Math.abs(diff) < 0.0001) {
                        status = 'ACURADO';
                    } else if (diff > 0) {
                        status = 'GANHO';
                    } else {
                        status = 'PERDA';
                    }
                }

                const lastDate = productLastDateMap[cod] || null;
                let daysSinceCount = null;
                let isOutdated = false;
                let isCountedToday = false;

                if (lastDate) {
                    const now = new Date();
                    const diffMs = now.getTime() - lastDate.getTime();
                    daysSinceCount = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                    if (daysSinceCount >= 14) {
                        isOutdated = true;
                    }
                    const todayStr = now.toISOString().slice(0, 10);
                    const lastDateStr = new Date(lastDate).toISOString().slice(0, 10);
                    if (todayStr === lastDateStr || daysSinceCount === 0) {
                        isCountedToday = true;
                    }
                }

                if (localCountsMap) {
                    const hasLocalCount = Object.keys(localCountsMap).some(k => k.endsWith(`_${cod}`));
                    if (hasLocalCount) isCountedToday = true;
                }

                return {
                    codigo: cod,
                    descricao: prod.descricao || prod['Descr.Espec.'] || '-',
                    unidade: prod.unidade || prod.Unidade || '-',
                    quantidade: sysQty,
                    qtd_contada: countedQty,
                    hasCount: hasCount,
                    divergencia: diff,
                    status: status,
                    endereco: prod.endereco || prod.Endereco || '',
                    fatorConv: prod.fator_conv || prod['Fator Conv.'] || 1,
                    tags: prod.tags || '',
                    fornecedores: prod.fornecedores || '',
                    observacao: productLastObsMap[cod] || '',
                    lastCountDate: lastDate,
                    daysSinceCount: daysSinceCount,
                    isOutdated: isOutdated,
                    isCountedToday: isCountedToday,
                    isDailyGoalItem: false
                };
            });

            // 1. Aplica primeiro os filtros de escopo do usuário (Tags, Fornecedores, Saldo)
            const userScopedItems = allMapped.filter(item => {
                if (saldoFilterMode === 'COM_SALDO') {
                    // Se o usuário digitou uma busca específica, permite que o item apareça mesmo com saldo 0 para que possa ser contado!
                    if (!term && Math.abs(item.quantidade) < 0.0001 && item.status !== 'GANHO' && item.status !== 'PERDA') {
                        return false;
                    }
                } else if (saldoFilterMode === 'SALDO_ZERO') {
                    // Exibe estritamente os itens que estão com saldo zerado no sistema
                    if (Math.abs(item.quantidade) >= 0.0001) {
                        return false;
                    }
                }
                // Se 'TODOS', inclui itens com saldo e zerados

                if (selectedTags.length > 0) {
                    const itemTags = item.tags ? item.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean) : [];
                    const isItemWithoutTag = itemTags.length === 0;

                    if (isExcludeTagMode) {
                        if (selectedTags.includes('__no_tag__') && isItemWithoutTag) return false;
                        const hasExcludedTag = itemTags.some(t => selectedTags.includes(t));
                        if (hasExcludedTag) return false;
                    } else {
                        const matchNoTag = selectedTags.includes('__no_tag__') && isItemWithoutTag;
                        const matchSpecificTag = itemTags.some(t => selectedTags.includes(t));
                        if (!matchNoTag && !matchSpecificTag) return false;
                    }
                }

                if (selectedFornecedores.length > 0) {
                    const itemForns = item.fornecedores ? item.fornecedores.split(/,|;/).map(f => f.trim().toLowerCase()).filter(Boolean) : [];
                    const isItemWithoutForn = itemForns.length === 0;

                    if (isExcludeFornMode) {
                        if (selectedFornecedores.includes('__no_forn__') && isItemWithoutForn) return false;
                        const hasExcludedForn = itemForns.some(f => selectedFornecedores.includes(f));
                        if (hasExcludedForn) return false;
                    } else {
                        const matchNoForn = selectedFornecedores.includes('__no_forn__') && isItemWithoutForn;
                        const matchSpecificForn = itemForns.some(f => selectedFornecedores.includes(f));
                        if (!matchNoForn && !matchSpecificForn) return false;
                    }
                }

                return true;
            });

            // 2. META FIXA DE 15 ITENS DO DIA DENTRO DO ESCOPO FILTRADO DO USUÁRIO
            const DAILY_GOAL_TARGET = 15;

            // Priorização dos 15 itens da meta:
            // Prioridade 5: Divergências ativas (Ganho ou Perda)
            // Prioridade 4: Desatualizados (>= 14 dias sem contagem)
            // Prioridade 3: Com saldo no sistema e sem contagem
            // Prioridade 2: Itens contados hoje (para manter o lote da meta estável)
            // Prioridade 1: Sem contagem
            // Prioridade 0: Demais itens
            const priorityGoalItems = [...userScopedItems].sort((a, b) => {
                const getScore = (item) => {
                    if (item.status === 'GANHO' || item.status === 'PERDA') return 5;
                    if (item.isOutdated) return 4;
                    if (item.quantidade > 0 && !item.hasCount) return 3;
                    if (item.isCountedToday) return 2;
                    if (!item.hasCount) return 1;
                    return 0;
                };
                const scoreDiff = getScore(b) - getScore(a);
                if (scoreDiff !== 0) return scoreDiff;
                return String(a.codigo).localeCompare(String(b.codigo));
            });

            const targetGoalCount = Math.min(DAILY_GOAL_TARGET, userScopedItems.length);
            const dailyGoalItems = priorityGoalItems.slice(0, targetGoalCount > 0 ? targetGoalCount : DAILY_GOAL_TARGET);
            const dailyGoalCodesSet = new Set(dailyGoalItems.map(i => i.codigo));

            userScopedItems.forEach(i => {
                i.isDailyGoalItem = dailyGoalCodesSet.has(i.codigo);
            });
            allMapped.forEach(i => {
                i.isDailyGoalItem = dailyGoalCodesSet.has(i.codigo);
            });

            const goalDoneCount = dailyGoalItems.filter(i => i.isCountedToday || (i.hasCount && (i.daysSinceCount === 0 || i.daysSinceCount === null))).length;
            const goalPct = targetGoalCount > 0 ? Math.min(100, Math.round((goalDoneCount / targetGoalCount) * 100)) : 100;

            const goalCountEl = document.getElementById('dailyGoalCountLabel');
            const goalDateEl = document.getElementById('dailyGoalDateLabel');
            const goalProgressEl = document.getElementById('dailyGoalProgressBar');
            const goalTextEl = document.getElementById('dailyGoalProgressText');

            if (goalCountEl) {
                const pendentesCount = Math.max(0, targetGoalCount - goalDoneCount);
                goalCountEl.innerText = `${targetGoalCount} itens prioritários (${pendentesCount > 0 ? pendentesCount + ' pendente(s)' : 'tudo contado!'})`;
            }
            if (goalDateEl) goalDateEl.innerText = `Hoje, ${new Date().toLocaleDateString('pt-BR')}`;
            if (goalProgressEl) goalProgressEl.style.width = `${goalPct}%`;
            if (goalTextEl) {
                if (goalDoneCount >= targetGoalCount && targetGoalCount > 0) {
                    goalTextEl.innerText = `🎉 Meta de ${targetGoalCount} itens Concluída! (100%)`;
                } else {
                    goalTextEl.innerText = `${goalDoneCount} de ${targetGoalCount} contados hoje (${goalPct}%)`;
                }
            }

            // 3. Filtra a listagem final para a tabela / cards
            filteredInventoryDataset = userScopedItems.filter(item => {
                if (isDailyGoalFilterActive && !item.isDailyGoalItem) return false;
                if (!selectedStatuses.includes(item.status)) return false;

                if (term) {
                    const normTerm = typeof normalizeProductCode === 'function' ? normalizeProductCode(term).toLowerCase() : term;
                    const inCode = item.codigo.toLowerCase().includes(term) || (normTerm !== term && item.codigo.toLowerCase().includes(normTerm));
                    const inDesc = item.descricao.toLowerCase().includes(term);
                    const inTags = item.tags.toLowerCase().includes(term);
                    const inForn = (item.fornecedores || '').toLowerCase().includes(term);
                    const addrMap = getProductAddressMap(item.codigo);
                    const allAddrs = Object.values(addrMap).join(' ').toLowerCase();
                    const inEnd = allAddrs.includes(term);
                    if (!inCode && !inDesc && !inTags && !inForn && !inEnd) return false;
                }

                return true;
            });

            if (isRouteSortActive) {
                const activeArmFilter = document.getElementById('invFilterArmazem') ? document.getElementById('invFilterArmazem').value : 'ALL';
                filteredInventoryDataset.sort((a, b) => {
                    const endA = getProductAddressForArmazem(a.codigo, activeArmFilter, true).trim().toUpperCase();
                    const endB = getProductAddressForArmazem(b.codigo, activeArmFilter, true).trim().toUpperCase();
                    if (!endA && endB) return 1;
                    if (endA && !endB) return -1;
                    if (endA && endB && endA !== endB) {
                        return endA.localeCompare(endB, undefined, { numeric: true, sensitivity: 'base' });
                    }
                    return String(a.codigo || '').trim().localeCompare(String(b.codigo || '').trim(), undefined, { numeric: true, sensitivity: 'base' });
                });
            } else {
                filteredInventoryDataset.sort((a, b) => {
                    return String(a.codigo || '').trim().localeCompare(String(b.codigo || '').trim(), undefined, { numeric: true, sensitivity: 'base' });
                });
            }

            if (resetPage) currentPage = 1;
            renderInventoryDashboard();
        }

        function renderInventoryDashboard() {
            renderInventoryKPIs();
            renderArmazemChart();
            renderInventoryPage();
        }

        function renderInventoryKPIs() {
            const totalCadastrados = rawSb1Dataset.length;
            const itensComSaldoCount = rawSb1Dataset.filter(prod => {
                const cod = prod.Codigo ? String(prod.Codigo).trim() : '';
                return (rawSaldoDataset.filter(s => s.produto === cod).reduce((acc, c) => acc + (c.quantidade || 0), 0)) > 0;
            }).length;

            const acuradosCount = filteredInventoryDataset.filter(i => i.status === 'ACURADO').length;
            const ganhosCount = filteredInventoryDataset.filter(i => i.status === 'GANHO').length;
            const perdasCount = filteredInventoryDataset.filter(i => i.status === 'PERDA').length;
            const totalContados = acuradosCount + ganhosCount + perdasCount;

            const pctAcurados = totalContados > 0 ? ((acuradosCount / totalContados) * 100).toFixed(1) : '0.0';
            const pctGanhos = totalContados > 0 ? ((ganhosCount / totalContados) * 100).toFixed(1) : '0.0';
            const pctPerdas = totalContados > 0 ? ((perdasCount / totalContados) * 100).toFixed(1) : '0.0';

            const volumeTotal = filteredInventoryDataset.reduce((sum, item) => sum + item.quantidade, 0);

            const elComSaldo = document.getElementById('kpiInvComSaldo');
            if (elComSaldo) elComSaldo.innerText = itensComSaldoCount.toLocaleString('pt-BR');

            const elSubComSaldo = document.getElementById('kpiInvSubComSaldo');
            if (elSubComSaldo) elSubComSaldo.innerText = `de ${totalCadastrados.toLocaleString('pt-BR')} no catálogo`;

            const elAcurados = document.getElementById('kpiInvAcurados');
            if (elAcurados) elAcurados.innerText = acuradosCount.toLocaleString('pt-BR');

            const elPctAcurados = document.getElementById('pctInvAcurados');
            if (elPctAcurados) elPctAcurados.innerText = `${pctAcurados}%`;

            const elGanhos = document.getElementById('kpiInvGanhos');
            if (elGanhos) elGanhos.innerText = ganhosCount.toLocaleString('pt-BR');

            const elPctGanhos = document.getElementById('pctInvGanhos');
            if (elPctGanhos) elPctGanhos.innerText = `${pctGanhos}%`;

            const elPerdas = document.getElementById('kpiInvPerdas');
            if (elPerdas) elPerdas.innerText = perdasCount.toLocaleString('pt-BR');

            const elPctPerdas = document.getElementById('pctInvPerdas');
            if (elPctPerdas) elPctPerdas.innerText = `${pctPerdas}%`;

            const elVolume = document.getElementById('kpiInvVolumeTotal');
            if (elVolume) elVolume.innerText = volumeTotal.toLocaleString('pt-BR');
        }

        function renderArmazemChart() {
            const ctx = document.getElementById('chartArmazemAcuracia');
            if (!ctx || typeof Chart === 'undefined') return;

            if (typeof ChartDataLabels !== 'undefined') {
                Chart.register(ChartDataLabels);
            }

            if (chartInstances['armazemAcuracia']) {
                chartInstances['armazemAcuracia'].destroy();
            }

            const selectedArmazens = Array.from(document.querySelectorAll('.armazem-checkbox:checked')).map(cb => cb.value);

            const armazemStats = {};
            selectedArmazens.forEach(arm => {
                armazemStats[arm] = { ok: 0, ganho: 0, perda: 0, pendente: 0 };
            });

            const itemsPerArmazem = {};
            const selectedFilial = document.getElementById('invFilterFilial') ? document.getElementById('invFilterFilial').value : 'ALL';
            const activeProductCodes = new Set(filteredInventoryDataset.map(item => item.codigo));

            rawSaldoDataset.forEach(s => {
                if (selectedFilial !== 'ALL' && s.filial !== selectedFilial) return;
                const arm = String(s.armazem || '01').trim().padStart(2, '0');
                if (!selectedArmazens.includes(arm)) return;
                const cod = String(s.produto).trim();
                if (!activeProductCodes.has(cod)) return;
                
                if (!itemsPerArmazem[arm]) itemsPerArmazem[arm] = {};
                if (!itemsPerArmazem[arm][cod]) itemsPerArmazem[arm][cod] = { sys: 0, count: null };
                itemsPerArmazem[arm][cod].sys += (s.quantidade || 0);
            });

            const combinedCounts = {};
            rawConfDataset.forEach(c => {
                if (selectedFilial !== 'ALL' && c.filial !== selectedFilial) return;
                const arm = String(c.armazem_contagem || c.armazem || '01').trim().padStart(2, '0');
                const cod = String(c.produto).trim();
                if (!selectedArmazens.includes(arm)) return;
                if (!activeProductCodes.has(cod)) return;
                combinedCounts[`${arm}_${cod}`] = c.qtd_contada;
            });

            Object.keys(localCountsMap).forEach(key => {
                const [armRaw, cod] = key.split('_');
                const arm = armRaw.padStart(2, '0');
                if (!selectedArmazens.includes(arm)) return;
                if (!activeProductCodes.has(cod)) return;
                combinedCounts[`${arm}_${cod}`] = localCountsMap[key];
            });

            Object.keys(combinedCounts).forEach(key => {
                const [arm, cod] = key.split('_');
                if (!itemsPerArmazem[arm]) itemsPerArmazem[arm] = {};
                if (!itemsPerArmazem[arm][cod]) itemsPerArmazem[arm][cod] = { sys: 0, count: null };
                itemsPerArmazem[arm][cod].count = combinedCounts[key];
            });

            Object.keys(itemsPerArmazem).forEach(arm => {
                if (!armazemStats[arm]) armazemStats[arm] = { ok: 0, ganho: 0, perda: 0, pendente: 0 };
                const prods = itemsPerArmazem[arm];
                
                Object.keys(prods).forEach(cod => {
                    const data = prods[cod];
                    if (data.count === null) {
                        if (data.sys > 0.0001) armazemStats[arm].pendente++;
                    } else {
                        const diff = data.count - data.sys;
                        if (Math.abs(diff) < 0.0001) armazemStats[arm].ok++;
                        else if (diff > 0) armazemStats[arm].ganho++;
                        else armazemStats[arm].perda++;
                    }
                });
            });

            const sortedArms = Object.keys(armazemStats).sort((a,b) => parseInt(a, 10) - parseInt(b, 10));
            const labels = sortedArms.map(a => `Armazém ${a.padStart(2, '0')}`);
                
            const dataOk = sortedArms.map(a => {
                const s = armazemStats[a];
                const total = s.ok + s.ganho + s.perda + s.pendente;
                return total > 0 ? ((s.ok / total) * 100).toFixed(1) : 0;
            });
            const dataGanho = sortedArms.map(a => {
                const s = armazemStats[a];
                const total = s.ok + s.ganho + s.perda + s.pendente;
                return total > 0 ? ((s.ganho / total) * 100).toFixed(1) : 0;
            });
            const dataPerda = sortedArms.map(a => {
                const s = armazemStats[a];
                const total = s.ok + s.ganho + s.perda + s.pendente;
                return total > 0 ? ((s.perda / total) * 100).toFixed(1) : 0;
            });
            const dataPendente = sortedArms.map(a => {
                const s = armazemStats[a];
                const total = s.ok + s.ganho + s.perda + s.pendente;
                return total > 0 ? ((s.pendente / total) * 100).toFixed(1) : 0;
            });

            chartInstances['armazemAcuracia'] = new Chart(ctx, {
                type: 'bar',
                plugins: (typeof ChartDataLabels !== 'undefined') ? [ChartDataLabels] : [],
                data: {
                    labels: labels,
                    datasets: [
                        { label: 'Não Contado', data: dataPendente, backgroundColor: '#cbd5e1', borderRadius: 4 },
                        { label: 'Acurado (OK)', data: dataOk, backgroundColor: '#10b981', borderRadius: 4 },
                        { label: 'Sobra (Ganho)', data: dataGanho, backgroundColor: '#3b82f6', borderRadius: 4 },
                        { label: 'Falta (Perda)', data: dataPerda, backgroundColor: '#f43f5e', borderRadius: 4 }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: {
                        padding: {
                            top: 20
                        }
                    },
                    plugins: {
                        legend: { position: 'top', labels: { boxWidth: 10, font: { weight: 'bold', size: 10 } } },
                        datalabels: { 
                            display: function(context) {
                                const val = parseFloat(context.dataset.data[context.dataIndex]) || 0;
                                return val > 0;
                            },
                            anchor: function(context) {
                                const val = parseFloat(context.dataset.data[context.dataIndex]) || 0;
                                return val < 80 ? 'end' : 'end';
                            },
                            align: function(context) {
                                const val = parseFloat(context.dataset.data[context.dataIndex]) || 0;
                                return val < 80 ? 'top' : 'bottom';
                            },
                            offset: function(context) {
                                const val = parseFloat(context.dataset.data[context.dataIndex]) || 0;
                                return val < 80 ? 4 : 4;
                            },
                            color: function(context) {
                                const val = parseFloat(context.dataset.data[context.dataIndex]) || 0;
                                const isDark = document.documentElement.classList.contains('dark');
                                if (val < 80) {
                                    return isDark ? '#f8fafc' : '#0f172a';
                                } else {
                                    return '#ffffff';
                                }
                            },
                            backgroundColor: function(context) {
                                const val = parseFloat(context.dataset.data[context.dataIndex]) || 0;
                                const isDark = document.documentElement.classList.contains('dark');
                                if (val < 80) {
                                    return isDark ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)';
                                } else {
                                    return 'rgba(15, 23, 42, 0.85)';
                                }
                            },
                            borderColor: function(context) {
                                const val = parseFloat(context.dataset.data[context.dataIndex]) || 0;
                                const isDark = document.documentElement.classList.contains('dark');
                                if (val < 80) {
                                    return isDark ? '#475569' : '#cbd5e1';
                                } else {
                                    return 'rgba(255, 255, 255, 0.35)';
                                }
                            },
                            borderWidth: 1,
                            borderRadius: 4,
                            padding: { top: 2, bottom: 2, left: 4, right: 4 },
                            font: { weight: '800', size: 9 }, 
                            formatter: function(v) {
                                const num = parseFloat(v);
                                return num > 0 ? num + '%' : '';
                            }
                        }
                    },
                    scales: {
                        x: { grid: { display: false }, ticks: { font: { weight: 'bold' } } },
                        y: { 
                            min: 0,
                            max: 115,
                            beginAtZero: true, 
                            grid: { color: document.documentElement.classList.contains('dark') ? '#334155' : '#f1f5f9' }, 
                            ticks: { 
                                font: { weight: 'bold' },
                                stepSize: 20,
                                callback: function(value) { return (value <= 100) ? value + '%' : ''; }
                            } 
                        }
                    }
                }
            });
        }

        function changeInventoryPage(delta) {
            const totalPages = Math.ceil(filteredInventoryDataset.length / ITEMS_PER_PAGE) || 1;
            currentPage += delta;
            if (currentPage < 1) currentPage = 1;
            if (currentPage > totalPages) currentPage = totalPages;
            renderInventoryPage();
        }

        function renderInventoryPage() {
            const tbody = document.getElementById('invTableBody');
            const mobileList = document.getElementById('invMobileList');

            if (tbody) tbody.innerHTML = '';
            if (mobileList) mobileList.innerHTML = '';

            const totalItems = filteredInventoryDataset.length;
            const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;

            if (currentPage > totalPages && totalPages > 0) currentPage = totalPages;

            const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
            const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalItems);

            const paginatedData = filteredInventoryDataset.slice(startIndex, endIndex);

            if (paginatedData.length === 0) {
                if (tbody) {
                    tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-8 text-center text-xs font-bold text-slate-400">Nenhum produto encontrado com os filtros selecionados.</td></tr>`;
                }
                if (mobileList) {
                    mobileList.innerHTML = `<div class="p-8 text-center text-xs font-bold text-slate-400 bg-white rounded-2xl border border-slate-200">Nenhum produto encontrado com os filtros selecionados.</div>`;
                }
            }

            paginatedData.forEach(item => {
                let statusBadge = '';
                const alertBadge = (item.isOutdated && item.daysSinceCount !== null) ? 
                    `<span class="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/50 flex items-center justify-center gap-1 shadow-sm mt-1" title="Contagem feita há ${item.daysSinceCount} dias. Recomenda-se reconfirmar."><i data-lucide="clock" class="w-2.5 h-2.5 text-amber-600"></i> Reconfirmar (${item.daysSinceCount}d)</span>` : '';

                if (item.status === 'ACURADO') {
                    statusBadge = `<div class="flex flex-col items-center"><span class="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 flex items-center justify-center gap-1"><i data-lucide="check-circle-2" class="w-3 h-3"></i> Acurado</span>${alertBadge}</div>`;
                } else if (item.status === 'GANHO') {
                    statusBadge = `<div class="flex flex-col items-center"><span class="px-2.5 py-1 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 flex items-center justify-center gap-1" title="Sobra de ${item.divergencia.toLocaleString('pt-BR')}"><i data-lucide="trending-up" class="w-3 h-3"></i> Ganho (+${item.divergencia.toLocaleString('pt-BR')})</span>${alertBadge}</div>`;
                } else if (item.status === 'PERDA') {
                    statusBadge = `<div class="flex flex-col items-center"><span class="px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 flex items-center justify-center gap-1" title="Falta de ${Math.abs(item.divergencia).toLocaleString('pt-BR')}"><i data-lucide="trending-down" class="w-3 h-3"></i> Perda (${item.divergencia.toLocaleString('pt-BR')})</span>${alertBadge}</div>`;
                } else {
                    statusBadge = `<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-400 flex items-center justify-center">Não Contado</span>`;
                }

                const contadaDisplay = item.hasCount ? item.qtd_contada.toLocaleString('pt-BR') : '-';
                const escapedDesc = (item.descricao || '').replace(/'/g, "\\'").replace(/"/g, "&quot;");
                const escapedTags = (item.tags || '').replace(/'/g, "\\'").replace(/"/g, "&quot;");

                let factorBadge = '';
                if (item.fatorConv && Number(item.fatorConv) > 0) {
                    factorBadge = `<span class="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200" title="Fator de Conversão Peso/Unidade">Fator: ${item.fatorConv}</span>`;
                }

                let enderecoBadgesHtml = '';
                const addrMap = getProductAddressMap(item.codigo);
                const activeArmFilter = document.getElementById('invFilterArmazem') ? document.getElementById('invFilterArmazem').value : 'ALL';

                if (activeArmFilter && activeArmFilter !== 'ALL') {
                    const armFormatted = String(activeArmFilter).padStart(2, '0');
                    const specificAddr = addrMap[armFormatted];
                    if (specificAddr) {
                        enderecoBadgesHtml = `<button type="button" onclick="event.stopPropagation(); openEditAddressModal('${item.codigo}', '${escapedDesc}', '${armFormatted}')" class="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-amber-50 text-amber-900 border border-amber-200/80 flex items-center gap-0.5 hover:bg-amber-100 transition-colors cursor-pointer" title="Clique para editar endereço no Armazém ${armFormatted}: ${specificAddr}"><i data-lucide="map-pin" class="w-2.5 h-2.5 text-amber-700"></i> Arm ${armFormatted}: ${specificAddr}</button>`;
                    } else {
                        enderecoBadgesHtml = `<button type="button" onclick="event.stopPropagation(); openEditAddressModal('${item.codigo}', '${escapedDesc}', '${armFormatted}')" class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-500 border border-slate-200 flex items-center gap-0.5 hover:bg-amber-50 hover:text-amber-800 transition-colors cursor-pointer" title="Clique para cadastrar localização no Armazém ${armFormatted}"><i data-lucide="map-pin" class="w-2.5 h-2.5 text-slate-400"></i> + Endereço (Arm ${armFormatted})</button>`;
                    }
                } else {
                    const entries = Object.entries(addrMap).filter(([k, v]) => Boolean(v));
                    if (entries.length === 0) {
                        enderecoBadgesHtml = `<button type="button" onclick="event.stopPropagation(); openEditAddressModal('${item.codigo}', '${escapedDesc}')" class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-500 border border-slate-200 flex items-center gap-0.5 hover:bg-amber-50 hover:text-amber-800 transition-colors cursor-pointer" title="Clique para cadastrar localização física por armazém"><i data-lucide="map-pin" class="w-2.5 h-2.5 text-slate-400"></i> + Endereço</button>`;
                    } else if (entries.length === 1) {
                        const [arm, end] = entries[0];
                        enderecoBadgesHtml = `<button type="button" onclick="event.stopPropagation(); openEditAddressModal('${item.codigo}', '${escapedDesc}', '${arm}')" class="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-amber-50 text-amber-900 border border-amber-200/80 flex items-center gap-0.5 hover:bg-amber-100 transition-colors cursor-pointer" title="Clique para editar endereço no Armazém ${arm}: ${end}"><i data-lucide="map-pin" class="w-2.5 h-2.5 text-amber-700"></i> Arm ${arm}: ${end}</button>`;
                    } else {
                        enderecoBadgesHtml = entries.map(([arm, end]) => `<button type="button" onclick="event.stopPropagation(); openEditAddressModal('${item.codigo}', '${escapedDesc}', '${arm}')" class="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-amber-50 text-amber-900 border border-amber-200/80 flex items-center gap-0.5 hover:bg-amber-100 transition-colors cursor-pointer" title="Armazém ${arm}: ${end} (Clique para editar)"><i data-lucide="map-pin" class="w-2.5 h-2.5 text-amber-700"></i> [${arm}] ${end}</button>`).join(' ');
                    }
                }

                let tagsBadges = '';
                if (item.tags || factorBadge || item.fornecedores || enderecoBadgesHtml) {
                    const tList = item.tags ? item.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean) : [];
                    const fornBadge = item.fornecedores 
                        ? `<span class="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-teal-50 text-teal-800 border border-teal-100 flex items-center gap-0.5" title="Fornecedor: ${item.fornecedores}"><i data-lucide="truck" class="w-2.5 h-2.5"></i> ${item.fornecedores}</span>` 
                        : '';
                    tagsBadges = `<div class="flex flex-wrap gap-1 mt-1">` +
                        (enderecoBadgesHtml ? enderecoBadgesHtml : '') +
                        (factorBadge ? factorBadge : '') +
                        (fornBadge ? fornBadge : '') +
                        tList.map(t => `<span class="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-100">${t}</span>`).join('') +
                        `</div>`;
                }

                if (tbody) {
                    const tr = document.createElement('tr');
                    tr.className = "hover:bg-slate-50 border-b border-slate-100 text-slate-700 transition-colors";
                    tr.innerHTML = `
                        <td class="px-4 py-3 text-xs font-bold text-slate-500">${item.codigo}</td>
                        <td class="px-4 py-3 text-xs font-black text-slate-800">
                            <div>${item.descricao}</div>
                            ${tagsBadges}
                            ${item.observacao ? `<div class="text-[10px] text-amber-700 dark:text-amber-400 font-semibold italic mt-0.5 flex items-center gap-1" title="Observação registrada na contagem"><i data-lucide="message-square" class="w-3 h-3 flex-shrink-0"></i> <span>${item.observacao}</span></div>` : ''}
                        </td>
                        <td class="px-3 py-3 text-center text-[10px] font-bold text-slate-500">${item.unidade}</td>
                        <td class="px-4 py-3 text-right text-xs font-bold text-slate-700">${item.quantidade.toLocaleString('pt-BR')}</td>
                        <td class="px-4 py-3 text-right text-xs font-black text-[#002f6c]">${contadaDisplay}</td>
                        <td class="px-4 py-3 text-center">${statusBadge}</td>
                        <td class="px-4 py-3 text-center">
                            <div class="flex items-center justify-center gap-1.5 flex-wrap">
                                <button type="button" onclick="openCountModal('${item.codigo}', '${escapedDesc}')" class="bg-teal-50 hover:bg-teal-600 text-teal-700 hover:text-white px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all shadow-sm flex items-center space-x-1 touch-active" title="Registrar Contagem">
                                    <i data-lucide="clipboard" class="w-3.5 h-3.5"></i>
                                    <span>Contar</span>
                                </button>
                                <button type="button" onclick="openTagsModal('${item.codigo}', '${escapedDesc}', '${escapedTags}')" class="bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all shadow-sm flex items-center space-x-1 touch-active" title="Gerenciar Tags">
                                    <i data-lucide="tag" class="w-3.5 h-3.5"></i>
                                    <span>Tags</span>
                                </button>
                                <button type="button" onclick="openFornecedoresModal('${item.codigo}', '${escapedDesc}', '${(item.fornecedores || '').replace(/'/g, "\\'").replace(/"/g, "&quot;")}')" class="bg-teal-50 hover:bg-teal-600 text-teal-700 hover:text-white px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all shadow-sm flex items-center space-x-1 touch-active" title="Gerenciar Fornecedores">
                                    <i data-lucide="truck" class="w-3.5 h-3.5"></i>
                                    <span>Forn.</span>
                                </button>
                                <button type="button" onclick="openItemAuditHistoryModal('${item.codigo}', '${escapedDesc}')" class="bg-slate-100 hover:bg-slate-700 text-slate-600 hover:text-white px-2 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all shadow-2xs flex items-center space-x-1 touch-active cursor-pointer" title="Ver Histórico de Auditoria">
                                    <i data-lucide="history" class="w-3.5 h-3.5"></i>
                                </button>
                            </div>
                        </td>
                    `;
                    tbody.appendChild(tr);
                }

                if (mobileList) {
                    const card = document.createElement('div');
                    card.className = "bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm space-y-2.5 hover:border-slate-300 transition-colors";
                    card.innerHTML = `
                        <div class="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                            <div class="flex items-center gap-2">
                                <span class="px-2 py-0.5 rounded-lg text-[11px] font-black bg-slate-100 text-slate-700 border border-slate-200">
                                    ${item.codigo}
                                </span>
                                <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500">
                                    ${item.unidade}
                                </span>
                            </div>
                            <div>
                                ${statusBadge}
                            </div>
                        </div>

                        <div>
                            <h4 class="text-xs font-black text-slate-900 leading-snug">${item.descricao}</h4>
                            ${tagsBadges}
                            ${item.observacao ? `<p class="text-[10px] text-amber-700 dark:text-amber-400 font-semibold italic mt-1 flex items-center gap-1"><i data-lucide="message-square" class="w-3 h-3 flex-shrink-0"></i> <span>${item.observacao}</span></p>` : ''}
                        </div>

                        <div class="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                            <div>
                                <span class="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Saldo Sistema</span>
                                <span class="font-bold text-slate-800 text-sm">${item.quantidade.toLocaleString('pt-BR')} ${item.unidade}</span>
                            </div>
                            <div class="text-right">
                                <span class="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Qtd. Contada</span>
                                <span class="font-black text-[#002f6c] text-sm">${contadaDisplay}</span>
                            </div>
                        </div>

                        <div class="flex items-center gap-1.5 pt-1">
                            <button type="button" onclick="openCountModal('${item.codigo}', '${escapedDesc}')" class="flex-1 bg-teal-600 hover:bg-teal-700 text-white py-2 rounded-xl text-xs font-black uppercase tracking-wider shadow-sm flex items-center justify-center space-x-1 touch-active">
                                <i data-lucide="clipboard" class="w-3.5 h-3.5"></i>
                                <span>Contar</span>
                            </button>
                            <button type="button" onclick="openTagsModal('${item.codigo}', '${escapedDesc}', '${escapedTags}')" class="bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white px-2.5 py-2 rounded-xl text-xs font-bold uppercase transition-all shadow-sm flex items-center space-x-1 touch-active">
                                <i data-lucide="tag" class="w-3.5 h-3.5"></i>
                                <span>Tags</span>
                            </button>
                            <button type="button" onclick="openFornecedoresModal('${item.codigo}', '${escapedDesc}', '${(item.fornecedores || '').replace(/'/g, "\\'").replace(/"/g, "&quot;")}')" class="bg-teal-50 hover:bg-teal-600 text-teal-700 hover:text-white px-2.5 py-2 rounded-xl text-xs font-bold uppercase transition-all shadow-sm flex items-center space-x-1 touch-active">
                                <i data-lucide="truck" class="w-3.5 h-3.5"></i>
                                <span>Forn.</span>
                            </button>
                            <button type="button" onclick="openItemAuditHistoryModal('${item.codigo}', '${escapedDesc}')" class="bg-slate-100 hover:bg-slate-700 text-slate-600 hover:text-white p-2 rounded-xl text-xs font-bold transition-all shadow-sm touch-active cursor-pointer" title="Ver Histórico">
                                <i data-lucide="history" class="w-4 h-4"></i>
                            </button>
                        </div>
                    `;
                    mobileList.appendChild(card);
                }
            });

            const btnPrev = document.getElementById('btnPrevPage');
            const btnNext = document.getElementById('btnNextPage');
            const indicator = document.getElementById('invPageIndicator');
            const counterLabel = document.getElementById('invCounterLabel');

            if (btnPrev) btnPrev.disabled = currentPage <= 1;
            if (btnNext) btnNext.disabled = currentPage >= totalPages;
            if (indicator) indicator.innerText = `Página ${currentPage} de ${totalPages}`;
            if (counterLabel) {
                if (totalItems === 0) {
                    counterLabel.innerText = "Nenhum item encontrado";
                } else {
                    counterLabel.innerText = `Exibindo ${startIndex + 1}-${endIndex} de ${totalItems.toLocaleString('pt-BR')} itens`;
                }
            }

            if (typeof lucide !== 'undefined') {
                if (tbody) lucide.createIcons({ root: tbody });
                if (mobileList) lucide.createIcons({ root: mobileList });
            }
        }

        // --- CONTAGEM FÍSICA MODAL & CALCULADORA & VALIDADE POR ARMAZÉM ---
        function openCountModal(codigo, descricao) {
            document.getElementById('countProductCode').value = codigo;
            document.getElementById('countProductName').innerText = `${codigo} - ${descricao}`;
            
            const prodItem = filteredInventoryDataset.find(p => p.codigo === codigo);
            const factor = (prodItem && prodItem.fatorConv) ? Number(prodItem.fatorConv) : 1;

            const addrEl = document.getElementById('countProductAddressText');
            if (addrEl) {
                addrEl.innerText = (prodItem && prodItem.endereco) ? prodItem.endereco : 'Sem endereço cadastrado';
            }

            const selFilial = document.getElementById('invFilterFilial');
            const isGlobal = isGlobalFilial(currentUser);
            const activeFilial = (isGlobal && selFilial && selFilial.value !== 'ALL' && selFilial.value !== '00') ? selFilial.value : getTargetFilialForSector();
            const filStr = (activeFilial && activeFilial !== 'ALL' && activeFilial !== '00') ? String(activeFilial).padStart(2, '0') : '01';

            const saldosProduto = rawSaldoDataset.filter(s => {
                if (String(s.produto).trim() !== codigo) return false;
                if (activeFilial && activeFilial !== 'ALL' && activeFilial !== '00') {
                    const sf = String(s.filial || '01').padStart(2, '0');
                    return sf === filStr || sf.replace(/^0+/, '') === filStr.replace(/^0+/, '');
                }
                return true;
            });

            const container = document.getElementById('countWarehousesContainer');
            container.innerHTML = '';
            
            const armMap = {};
            saldosProduto.forEach(s => {
                const a = String(s.armazem).trim().padStart(2, '0');
                armMap[a] = (armMap[a] || 0) + (s.quantidade || 0);
            });

            rawConfDataset.filter(c => {
                if (String(c.produto).trim() !== codigo) return false;
                if (activeFilial && activeFilial !== 'ALL' && activeFilial !== '00') {
                    const cf = String(c.filial || '01').padStart(2, '0');
                    return cf === filStr || cf.replace(/^0+/, '') === filStr.replace(/^0+/, '');
                }
                return true;
            }).forEach(c => {
                const a = String(c.armazem || '01').trim().padStart(2, '0');
                if (armMap[a] === undefined) armMap[a] = 0;
            });

            if (Object.keys(armMap).length === 0) {
                armMap['01'] = 0;
            }

            let armazens = Object.keys(armMap).map(a => ({ armazem: a, quantidade: armMap[a] }));
            armazens.sort((a,b) => parseInt(a.armazem, 10) - parseInt(b.armazem, 10));

            armazens.forEach(s => {
                renderWarehouseCountCard(s.armazem, s.quantidade, factor, codigo, filStr);
            });

            // Carrega a observação mais recente do produto se existir
            const lastProdCount = rawConfDataset.filter(c => String(c.produto).trim() === codigo).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0];
            document.getElementById('countInputObs').value = (lastProdCount && lastProdCount.observacao) ? lastProdCount.observacao : '';
            toggleAppCalculator(false);

            const modal = document.getElementById('countModal');
            if (modal) modal.classList.remove('pointer-events-none', 'opacity-0');
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }

        function renderWarehouseCountCard(armazemCode, sysQty, factor, codigo, filStr) {
            const container = document.getElementById('countWarehousesContainer');
            if (!container) return;

            if (document.getElementById(`countInput_${armazemCode}`)) return;

            const targetFilStr = String(filStr || '01').padStart(2, '0');
            const targetFilRaw = targetFilStr.replace(/^0+/, '') || '0';
            const existingVal = getProductValidadeForArmazem(codigo, armazemCode, targetFilStr);

            const historyForArm = rawConfDataset.filter(c => {
                if (String(c.produto).trim() !== codigo) return false;
                if (String(c.armazem).trim().padStart(2, '0') !== String(armazemCode).trim().padStart(2, '0')) return false;
                if (targetFilStr && targetFilStr !== 'ALL' && targetFilStr !== '00') {
                    const cFil = String(c.filial || '01').trim().padStart(2, '0');
                    const cFilRaw = cFil.replace(/^0+/, '') || '0';
                    return cFil === targetFilStr || cFilRaw === targetFilRaw;
                }
                return true;
            });
            
            historyForArm.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
            const lastCount = historyForArm[0];

            const lastQty = (lastCount && lastCount.quantidade_contada !== undefined && lastCount.quantidade_contada !== null) 
                ? Number(lastCount.quantidade_contada) 
                : ((lastCount && lastCount.qtd_contada !== undefined) ? Number(lastCount.qtd_contada) : null);

            const sessionQty = (localCountsMap[`${armazemCode}_${codigo}`] !== undefined)
                ? Number(localCountsMap[`${armazemCode}_${codigo}`])
                : lastQty;

            let sumBtnHtml = '';
            if (sessionQty !== null && sessionQty > 0) {
                sumBtnHtml = `
                    <button type="button" onclick="appendCountPrevious('${armazemCode}', ${sessionQty})" class="px-2 py-0.5 rounded-md text-[9px] font-black bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-all flex items-center gap-1 shadow-sm" title="Somar com a contagem anterior de ${sessionQty.toLocaleString('pt-BR')} un.">
                        <i data-lucide="plus" class="w-3 h-3 text-blue-600"></i>
                        <span>+ Somar (${sessionQty.toLocaleString('pt-BR')} un.)</span>
                    </button>
                `;
            }
            
            let lastInfoHtml = '';
            if (lastCount && lastCount.created_at) {
                const dt = new Date(lastCount.created_at);
                const dateStr = dt.toLocaleDateString('pt-BR') + ' às ' + dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                const whoStr = lastCount.quem_contou || lastCount.conferente_nome || 'SISTEMA';
                const qtyStr = (lastCount.quantidade_contada !== undefined && lastCount.quantidade_contada !== null) ? lastCount.quantidade_contada.toLocaleString('pt-BR') : ((lastCount.qtd_contada !== undefined) ? lastCount.qtd_contada.toLocaleString('pt-BR') : '0');
                
                lastInfoHtml = `
                    <div class="mt-2 text-[10px] bg-slate-100/80 p-2 rounded-lg border border-slate-200/60 space-y-1 text-slate-600">
                        <div class="flex flex-wrap items-center justify-between gap-1">
                            <span class="flex items-center gap-1 font-bold text-slate-500">
                                <i data-lucide="history" class="w-3 h-3 text-teal-600"></i> Última contagem:
                            </span>
                            <span class="font-black text-slate-800 text-right">
                                ${qtyStr} un. <span class="text-slate-400 font-normal">|</span> ${whoStr} <span class="text-slate-400 font-normal">|</span> ${dateStr}
                            </span>
                        </div>
                        ${lastCount.observacao ? `
                            <div class="text-[10px] text-amber-800 dark:text-amber-300 font-semibold italic bg-amber-50 dark:bg-amber-950/40 p-1.5 rounded border border-amber-200 dark:border-amber-900/60 flex items-start gap-1">
                                <i data-lucide="message-square" class="w-3 h-3 text-amber-600 flex-shrink-0 mt-0.5"></i>
                                <span>Obs anterior: ${lastCount.observacao}</span>
                            </div>
                        ` : ''}
                    </div>
                `;
            } else {
                lastInfoHtml = `
                    <div class="mt-2 text-[10px] bg-slate-50 p-1.5 rounded-lg border border-slate-100 flex items-center justify-between text-slate-400">
                        <span class="flex items-center gap-1">
                            <i data-lucide="history" class="w-3 h-3 text-slate-300"></i> Última contagem:
                        </span>
                        <span class="font-bold text-slate-400">Sem contagens anteriores</span>
                    </div>
                `;
            }

            const sysQtyDisplay = `<span class="text-slate-700">${sysQty.toLocaleString('pt-BR')}</span>`;
            const armAddress = getProductAddressForArmazem(codigo, armazemCode, false);

            const cardHtml = `
                <div id="armCard_${armazemCode}" class="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm space-y-2">
                    <div class="flex items-center justify-between">
                        <div>
                            <div class="flex items-center gap-1.5 flex-wrap">
                                <p class="text-[10px] font-black text-slate-500 uppercase tracking-wider">Armazém <span class="text-[#002f6c] text-xs font-black">${armazemCode}</span></p>
                                <button type="button" onclick="event.stopPropagation(); openEditAddressModal('${codigo}', '', '${armazemCode}')" class="px-1.5 py-0.5 rounded text-[9px] font-extrabold ${armAddress ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-slate-100 text-slate-500 border border-slate-200'} flex items-center gap-0.5 hover:bg-amber-200 transition-colors cursor-pointer" title="Clique para editar endereço no Armazém ${armazemCode}">
                                    <i data-lucide="map-pin" class="w-2.5 h-2.5 text-amber-700"></i>
                                    <span id="armCardAddressText_${armazemCode}">${armAddress || '+ Endereço'}</span>
                                </button>
                            </div>
                            <p class="text-[10px] font-bold text-slate-400 mt-0.5">Saldo Sis: ${sysQtyDisplay}</p>
                        </div>
                        <div class="w-40 text-right">
                            <input type="text" inputmode="none" readonly data-armazem="${armazemCode}" data-factor="${factor}" data-mode="peso" data-prev-count="${sessionQty !== null ? sessionQty : 0}" id="countInput_${armazemCode}" onclick="this.blur(); onArmazemInputClick('${armazemCode}')" onfocus="this.blur(); onArmazemInputClick('${armazemCode}')" oninput="updateCountPreview('${armazemCode}')" class="count-warehouse-input w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 text-right cursor-pointer" placeholder="Toque para contar">
                        </div>
                    </div>
                    
                    <div class="flex items-center justify-between pt-1 border-t border-slate-100 flex-wrap gap-1">
                        <div class="flex items-center gap-1 flex-wrap">
                            <button type="button" onclick="setCountInputMode('${armazemCode}', 'peso')" id="btnModePeso_${armazemCode}" class="px-2 py-0.5 rounded-md text-[9px] font-black bg-teal-600 text-white transition-all">
                                ⚖️ Peso
                            </button>
                            <button type="button" onclick="setCountInputMode('${armazemCode}', 'peca')" id="btnModePeca_${armazemCode}" class="px-2 py-0.5 rounded-md text-[9px] font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all">
                                📦 Peças (Fator: ${factor})
                            </button>
                            ${sumBtnHtml}
                        </div>
                        <div id="countPreviewCalc_${armazemCode}" class="text-[10px] font-black text-teal-700"></div>
                    </div>

                    ${lastInfoHtml}
                </div>
            `;
            container.insertAdjacentHTML('beforeend', cardHtml);
        }

        function appendCountPrevious(armazemCode, prevVal) {
            const inp = document.getElementById(`countInput_${armazemCode}`);
            if (!inp) return;
            const currentText = inp.value.trim();
            if (!currentText) {
                inp.value = `${prevVal} + `;
            } else if (!currentText.includes('+') && !currentText.includes('-') && !currentText.includes('*') && !currentText.includes('/')) {
                inp.value = `${prevVal} + ${currentText}`;
            } else {
                inp.value = `${currentText} + ${prevVal}`;
            }
            setActiveCalcTarget(armazemCode);
            updateCountPreview(armazemCode);
            toggleAppCalculator(true);
        }

        function promptAddExtraWarehouseCard() {
            const inputArm = prompt("Informe o número do armazém (ex: 01, 02, 05, 09, 50...):");
            if (!inputArm) return;
            const armCode = inputArm.trim().padStart(2, '0');
            const codigo = document.getElementById('countProductCode').value;
            const prodItem = filteredInventoryDataset.find(p => p.codigo === codigo);
            const factor = (prodItem && prodItem.fatorConv) ? Number(prodItem.fatorConv) : 1;
            const userFilial = currentUser ? parseInt(currentUser.filial_atual, 10) : 1;
            
            renderWarehouseCountCard(armCode, 0, factor, codigo, userFilial);
            if (typeof lucide !== 'undefined') lucide.createIcons();
            const inp = document.getElementById(`countInput_${armCode}`);
            if (inp) inp.focus();
        }

        function setCountInputMode(armazem, mode) {
            const inp = document.getElementById(`countInput_${armazem}`);
            const btnPeso = document.getElementById(`btnModePeso_${armazem}`);
            const btnPeca = document.getElementById(`btnModePeca_${armazem}`);
            if (!inp || !btnPeso || !btnPeca) return;

            inp.setAttribute('data-mode', mode);
            if (mode === 'peca') {
                btnPeca.className = 'px-2 py-0.5 rounded-md text-[9px] font-black bg-teal-600 text-white transition-all';
                btnPeso.className = 'px-2 py-0.5 rounded-md text-[9px] font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all';
                inp.placeholder = "Qtd em peças";
            } else {
                btnPeso.className = 'px-2 py-0.5 rounded-md text-[9px] font-black bg-teal-600 text-white transition-all';
                btnPeca.className = 'px-2 py-0.5 rounded-md text-[9px] font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all';
                inp.placeholder = "Qtd em peso";
            }
            updateCountPreview(armazem);
        }

        function toggleAppCalculator(show = null) {
            const keypad = document.getElementById('appCalculatorKeypad');
            const label = document.getElementById('labelToggleCalc');
            if (!keypad) return;

            const isHidden = keypad.classList.contains('hidden');
            const shouldShow = (show !== null) ? show : isHidden;

            if (shouldShow) {
                keypad.classList.remove('hidden');
                if (label) label.innerText = 'Fechar Calculadora';
            } else {
                keypad.classList.add('hidden');
                if (label) label.innerText = 'Abrir Calculadora';
            }
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }

        function onArmazemInputClick(armazemCode) {
            setActiveCalcTarget(armazemCode);
            toggleAppCalculator(true);
        }

        function setActiveCalcTarget(armazemCode) {
            activeCalcArmazemCode = armazemCode;
            const label = document.getElementById('appCalcTargetLabel');
            if (label) {
                label.innerText = armazemCode ? `Armazém ${armazemCode}` : `Toque no campo para digitar`;
            }

            document.querySelectorAll('[id^="armCard_"]').forEach(card => {
                card.classList.remove('border-teal-500', 'ring-2', 'ring-teal-500/20', 'bg-teal-50/20');
                card.classList.add('border-slate-200');
            });

            if (armazemCode) {
                const activeCard = document.getElementById(`armCard_${armazemCode}`);
                if (activeCard) {
                    activeCard.classList.remove('border-slate-200');
                    activeCard.classList.add('border-teal-500', 'ring-2', 'ring-teal-500/20', 'bg-teal-50/20');
                    activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }
        }

        function parseSmartMathExpression(exprStr, prevCount = 0) {
            if (exprStr === null || exprStr === undefined) return null;
            let s = String(exprStr).trim();
            if (!s) return null;

            s = s.replace(/,/g, '.');

            // Se a expressão começar com +, soma ao valor anterior
            if (s.startsWith('+')) {
                s = `${prevCount}` + s;
            }

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

        function calcKeypadPress(char) {
            if (!activeCalcArmazemCode) {
                const firstInp = document.querySelector('.count-warehouse-input');
                if (firstInp) {
                    const arm = firstInp.getAttribute('data-armazem');
                    setActiveCalcTarget(arm);
                } else {
                    return;
                }
            }

            const inp = document.getElementById(`countInput_${activeCalcArmazemCode}`);
            if (!inp) return;

            if (char === 'C') {
                inp.value = '';
                updateCountPreview(activeCalcArmazemCode);
            } else if (char === 'BACKSPACE') {
                inp.value = inp.value.slice(0, -1);
                updateCountPreview(activeCalcArmazemCode);
            } else if (char === '=') {
                const rawVal = inp.value.trim();
                if (rawVal) {
                    const prevCount = parseFloat(inp.getAttribute('data-prev-count')) || 0;
                    const val = parseSmartMathExpression(rawVal, prevCount);
                    if (val !== null && !isNaN(val) && val >= 0) {
                        inp.value = String(val);
                        updateCountPreview(activeCalcArmazemCode);
                        toggleAppCalculator(false);

                        const form = document.querySelector('#countModal form');
                        if (form) {
                            if (typeof form.requestSubmit === 'function') {
                                form.requestSubmit();
                            } else {
                                form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                            }
                        }
                    } else {
                        showAlert("Expressão de cálculo inválida. Corrija o valor digitado.", "warning");
                    }
                } else {
                    showAlert("Digite um valor ou cálculo para salvar.", "warning");
                }
                return;
            } else {
                inp.value += char;
                updateCountPreview(activeCalcArmazemCode);
            }
        }

        function updateCountPreview(armazem) {
            const inp = document.getElementById(`countInput_${armazem}`);
            const prev = document.getElementById(`countPreviewCalc_${armazem}`);
            if (!inp || !prev) return;

            const rawVal = inp.value.trim();
            if (!rawVal) {
                prev.innerText = '';
                return;
            }

            const prevCount = parseFloat(inp.getAttribute('data-prev-count')) || 0;
            const val = parseSmartMathExpression(rawVal, prevCount);
            const mode = inp.getAttribute('data-mode') || 'peso';
            const factor = parseFloat(inp.getAttribute('data-factor')) || 1;

            if (val === null || isNaN(val) || val < 0) {
                prev.innerHTML = `<span class="text-amber-600 font-bold">Expressão incompleta...</span>`;
                return;
            }

            const isMathExpr = /[+\-*/()]/.test(rawVal) || rawVal.startsWith('+');

            if (mode === 'peca') {
                const totalKg = val * factor;
                if (isMathExpr) {
                    prev.innerHTML = `<span class="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shadow-sm font-bold">= ${val.toLocaleString('pt-BR')} pçs × ${factor} = <strong>${totalKg.toLocaleString('pt-BR')}</strong></span>`;
                } else {
                    prev.innerText = `= ${val} pçs × ${factor} = ${totalKg.toLocaleString('pt-BR')}`;
                }
            } else {
                if (isMathExpr) {
                    prev.innerHTML = `<span class="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shadow-sm font-bold">= <strong>${val.toLocaleString('pt-BR')}</strong></span>`;
                } else {
                    prev.innerText = `= ${val.toLocaleString('pt-BR')}`;
                }
            }
        }

        function closeCountModal() {
            const modal = document.getElementById('countModal');
            if (modal) modal.classList.add('pointer-events-none', 'opacity-0');
        }

        async function handleCountSubmit(e) {
            e.preventDefault();
            const codigo = String(document.getElementById('countProductCode').value).trim();
            const obs = document.getElementById('countInputObs').value.trim();
            const inputs = document.querySelectorAll('.count-warehouse-input');
            
            const selFilial = document.getElementById('invFilterFilial');
            const isGlobal = isGlobalFilial(currentUser);
            const activeFilial = (isGlobal && selFilial && selFilial.value !== 'ALL' && selFilial.value !== '00') ? selFilial.value : getTargetFilialForSector();
            const rawFilial = (activeFilial && activeFilial !== 'ALL' && activeFilial !== '00') ? String(activeFilial).padStart(2, '0') : (currentUser ? String(currentUser.filial_atual || '01').padStart(2, '0') : '01');
            const userFilStr = rawFilial;

            const insertsContagem = [];
            const conferenteIdent = currentUser ? `${currentUser.matricula} - ${currentUser.nome}` : 'SISTEMA';

            inputs.forEach(inp => {
                const armazem = String(inp.getAttribute('data-armazem')).trim().padStart(2, '0');
                const valStr = inp.value.trim();
                const mode = inp.getAttribute('data-mode') || 'peso';
                const factor = parseFloat(inp.getAttribute('data-factor')) || 1;

                if (valStr !== '') {
                    const prevCount = parseFloat(inp.getAttribute('data-prev-count')) || 0;
                    const evaluatedVal = parseSmartMathExpression(valStr, prevCount);
                    if (evaluatedVal !== null && !isNaN(evaluatedVal) && evaluatedVal >= 0) {
                        const qtdContada = (mode === 'peca') ? (evaluatedVal * factor) : evaluatedVal;
                        localCountsMap[`${armazem}_${codigo}`] = qtdContada;

                        const currentSysRecord = rawSaldoDataset.find(s => {
                            if (s.produto !== codigo || s.armazem !== armazem) return false;
                            const sf = String(s.filial || '01').padStart(2, '0');
                            return sf === userFilStr || sf.replace(/^0+/, '') === userFilStr.replace(/^0+/, '');
                        });
                        const qtdSistema = currentSysRecord ? parseFloat(currentSysRecord.quantidade || 0) : 0;

                        insertsContagem.push({
                            filial: rawFilial,
                            armazem_contagem: armazem,
                            produto: codigo,
                            quantidade_contada: qtdContada,
                            quantidade_sistema: qtdSistema,
                            quem_contou: conferenteIdent,
                            observacao: obs || null
                        });
                    }
                }
            });

            if (insertsContagem.length === 0) {
                showAlert("Preencha a contagem de pelo menos um armazém para salvar.", "warning");
                return;
            }

            const countTable = currentSector === 'INDUSTRIA' ? 'contagem_industria' : 'contagem_comercio';

            let savedOnline = false;
            if (supabaseClient && currentUser && navigator.onLine) {
                try {
                    const { error } = await supabaseClient.from(countTable).insert(insertsContagem);
                    if (error) {
                        const fallbackSemFilial = insertsContagem.map(i => {
                            const { filial, ...rest } = i;
                            return rest;
                        });
                        await supabaseClient.from(countTable).insert(fallbackSemFilial);
                    }
                    savedOnline = true;
                } catch (e) {
                    console.error("Erro ao salvar contagem:", e);
                    saveOfflineAction('insert', countTable, insertsContagem);
                }
            } else {
                saveOfflineAction('insert', countTable, insertsContagem);
            }

            // Registra na Trilha de Auditoria
            insertsContagem.forEach(c => {
                logAuditAction({
                    filial: c.filial || '01',
                    armazem: c.armazem_contagem || '01',
                    produto: c.produto,
                    acao: 'CONTAGEM_INVENTARIO',
                    detalhes: `Contagem lançada: ${Number(c.quantidade_contada).toLocaleString('pt-BR')} (Sistema: ${Number(c.quantidade_sistema).toLocaleString('pt-BR')}) por ${c.quem_contou}. ${c.observacao ? `Obs: ${c.observacao}` : ''}`,
                    modulo: 'INVENTARIO'
                });
            });

            if (savedOnline) {
                showAlert("Contagem salva com sucesso!", "success");
            }

            closeCountModal();
            await loadInventoryData();
        }

        // --- LANÇAMENTO EM MASSA ---
        function openMassCountModal() {
            massCountRows = [];
            addMassCountRow();
            addMassCountRow();
            addMassCountRow();
            
            const modal = document.getElementById('massCountModal');
            if (modal) modal.classList.remove('pointer-events-none', 'opacity-0');
            lucide.createIcons();
        }

        function closeMassCountModal() {
            const modal = document.getElementById('massCountModal');
            if (modal) modal.classList.add('pointer-events-none', 'opacity-0');
        }

        function addMassCountRow() {
            const rowId = Date.now() + Math.random().toString(36).substr(2, 4);
            massCountRows.push({ id: rowId, armazem: '01', codigo: '', validade: '', modo: 'peca', qtd: '', total: 0 });
            renderMassCountRows();
        }

        function removeMassCountRow(rowId) {
            massCountRows = massCountRows.filter(r => r.id !== rowId);
            if (massCountRows.length === 0) addMassCountRow();
            renderMassCountRows();
        }

        function getAvailableArmazensList() {
            const list = [...new Set(rawSaldoDataset.map(s => s.armazem ? String(s.armazem).trim() : '').filter(Boolean))].sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
            if (list.length === 0) return ['01', '02', '03', '04', '05'];
            return list;
        }

        function renderMassCountRows() {
            const tbody = document.getElementById('massCountTableBody');
            if (!tbody) return;

            const armazensDisponiveis = getAvailableArmazensList();

            let html = '';
            massCountRows.forEach((row) => {
                const prodMatch = rawSb1Dataset.find(p => String(p.Codigo).trim() === row.codigo.trim());
                const factor = (prodMatch && prodMatch['Fator Conv.']) ? Number(prodMatch['Fator Conv.']) : 1;
                const descStr = prodMatch ? prodMatch['Descr.Espec.'] : (row.codigo ? 'Produto não localizado' : 'Digite o código');
                
                if (!armazensDisponiveis.includes(row.armazem) && armazensDisponiveis.length > 0) {
                    row.armazem = armazensDisponiveis[0];
                }

                const valNum = parseFloat(row.qtd) || 0;
                const totalCalculado = (row.modo === 'peca') ? (valNum * factor) : valNum;
                row.total = totalCalculado;

                const armOptionsHtml = armazensDisponiveis.map(a => 
                    `<option value="${a}" ${row.armazem === a ? 'selected' : ''}>Armazém ${a.padStart(2, '0')}</option>`
                ).join('');

                html += `
                    <tr class="flex flex-col md:table-row border-b border-slate-100 hover:bg-slate-50 transition-colors p-4 md:p-2 gap-2 bg-slate-50/50 md:bg-transparent rounded-2xl md:rounded-none mb-3 md:mb-0">
                        <td class="p-0 md:p-2 block md:table-cell md:w-28">
                            <label class="block md:hidden text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Armazém</label>
                            <select onchange="updateMassRowField('${row.id}', 'armazem', this.value)" class="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-teal-600">
                                ${armOptionsHtml}
                            </select>
                        </td>
                        <td class="p-0 md:p-2 block md:table-cell">
                            <label class="block md:hidden text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Código / Produto</label>
                            <input type="text" value="${row.codigo}" oninput="updateMassRowField('${row.id}', 'codigo', this.value, this)" placeholder="Ex: 07000151..." class="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-xs font-black text-slate-900 focus:ring-2 focus:ring-teal-600 uppercase">
                            <span id="mass-desc-${row.id}" class="block text-[10px] font-bold text-slate-400 mt-0.5 truncate">${descStr} ${prodMatch ? `(Fator: ${factor})` : ''}</span>
                        </td>
                        <td class="p-0 md:p-2 block md:table-cell md:w-28">
                            <label class="block md:hidden text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Validade</label>
                            <input type="month" value="${row.validade || ''}" onchange="updateMassRowField('${row.id}', 'validade', this.value)" class="w-full bg-slate-50 border border-slate-200 rounded-lg p-1 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-amber-500">
                        </td>
                        <td class="p-0 md:p-2 block md:table-cell md:w-24">
                            <label class="block md:hidden text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Modo</label>
                            <select onchange="updateMassRowField('${row.id}', 'modo', this.value)" class="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-teal-600">
                                <option value="peso" ${row.modo === 'peso' ? 'selected' : ''}>⚖️ Peso</option>
                                <option value="peca" ${row.modo === 'peca' ? 'selected' : ''}>📦 Peça</option>
                            </select>
                        </td>
                        <td class="p-0 md:p-2 block md:table-cell md:w-24 text-right">
                            <label class="block md:hidden text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1 text-left">Qtd Lançada</label>
                            <input type="number" step="any" min="0" value="${row.qtd}" oninput="updateMassRowField('${row.id}', 'qtd', this.value, this)" placeholder="0" class="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-xs font-black text-slate-900 focus:ring-2 focus:ring-teal-600 text-right">
                        </td>
                        <td id="mass-total-${row.id}" class="p-0 md:p-2 block md:table-cell md:w-24 text-right font-black text-teal-700 text-xs">
                            <label class="block md:hidden text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1 text-left">Total</label>
                            <span class="py-1.5 block md:inline">${totalCalculado > 0 ? totalCalculado.toLocaleString('pt-BR') : '-'}</span>
                        </td>
                        <td class="p-0 md:p-2 block md:table-cell md:w-10 text-right md:text-center">
                            <button type="button" onclick="removeMassCountRow('${row.id}')" class="bg-rose-50 hover:bg-rose-100 text-rose-500 hover:text-rose-700 px-3 py-1.5 rounded-lg border border-rose-200 text-xs font-bold inline-flex items-center gap-1 active:scale-95 transition-all md:p-1 md:bg-transparent md:border-0" title="Remover Linha">
                                <i data-lucide="trash-2" class="w-4 h-4"></i>
                                <span class="md:hidden font-black uppercase text-[9px]">Excluir</span>
                            </button>
                        </td>
                    </tr>
                `;
            });
            tbody.innerHTML = html;
            lucide.createIcons();
        }

        function updateMassRowField(rowId, field, value, el) {
            const row = massCountRows.find(r => r.id === rowId);
            if (!row) return;
            row[field] = value;

            const prodMatch = rawSb1Dataset.find(p => String(p.Codigo).trim() === (row.codigo ? row.codigo.trim() : ''));
            const factor = (prodMatch && prodMatch['Fator Conv.']) ? Number(prodMatch['Fator Conv.']) : 1;
            const descStr = prodMatch ? prodMatch['Descr.Espec.'] : (row.codigo ? 'Produto não localizado' : 'Digite o código');
            const valNum = parseFloat(row.qtd) || 0;
            const totalCalculado = (row.modo === 'peca') ? (valNum * factor) : valNum;
            row.total = totalCalculado;

            const descSpan = document.getElementById(`mass-desc-${row.id}`);
            if (descSpan) descSpan.innerText = `${descStr} ${prodMatch ? `(Fator: ${factor})` : ''}`;

            const totalTd = document.getElementById(`mass-total-${row.id}`);
            if (totalTd) totalTd.innerText = totalCalculado > 0 ? totalCalculado.toLocaleString('pt-BR') : '-';

            if (field === 'armazem' || field === 'modo') {
                renderMassCountRows();
            }
        }

        async function saveMassCountLote() {
            if (!supabaseClient) return;
            const validRows = massCountRows.filter(r => r.codigo.trim() !== '' && !isNaN(parseFloat(r.qtd)) && parseFloat(r.qtd) > 0);
            
            if (validRows.length === 0) {
                showAlert("Preencha ao menos uma linha válida com Código e Quantidade.", "warning");
                return;
            }

            const countTable = currentSector === 'INDUSTRIA' ? 'contagem_industria' : 'contagem_comercio';
            const rawFilial = currentUser ? String(currentUser.filial_atual).trim() : '01';
            const conferenteIdent = currentUser ? `${currentUser.matricula} - ${currentUser.nome}` : 'SISTEMA';

            const inserts = [];

            validRows.forEach(r => {
                const cod = r.codigo.trim();
                const arm = String(r.armazem).trim().padStart(2, '0');
                const total = r.total;
                localCountsMap[`${arm}_${cod}`] = total;

                const userFilStr = currentUser ? String(currentUser.filial_atual).trim().padStart(2, '0') : '01';
                const currentSysRecord = rawSaldoDataset.find(s => s.produto === cod && s.armazem === arm && s.filial === userFilStr);
                const qtdSistema = currentSysRecord ? parseFloat(currentSysRecord.quantidade || 0) : 0;

                inserts.push({
                    filial: rawFilial,
                    armazem_contagem: arm,
                    produto: cod,
                    quantidade_contada: total,
                    quantidade_sistema: qtdSistema,
                    quem_contou: conferenteIdent
                });
            });

            try {
                const { error } = await supabaseClient.from(countTable).insert(inserts);
                if (error) {
                    showAlert("Erro ao salvar contagens em lote: " + error.message, "error");
                    return;
                }

                showAlert(`${validRows.length} contagem(ns) salva(s) com sucesso em lote!`, "success");
                closeMassCountModal();
                await loadInventoryData();
            } catch (err) {
                showAlert("Erro de rede ao salvar lote.", "error");
            }
        }

        // --- GESTÃO DE PRODUTO SB1 ---
        function openProductModal() {
            document.getElementById('prodCodigo').value = '';
            document.getElementById('prodDescricao').value = '';
            document.getElementById('prodFatorConv').value = '1';
            document.getElementById('prodTags').value = '';
            document.getElementById('prodCustomUnidade').value = '';
            document.getElementById('prodCustomUnidade').classList.add('hidden');
            document.getElementById('prodSetorTarget').value = currentSector;

            const selUn = document.getElementById('prodUnidadeSelect');
            if (selUn) {
                const defaultUnits = ['UN', 'KG', 'MT', 'CX', 'PC', 'RL', 'LT', 'M2', 'M3', 'PAR', 'TON', 'GL', 'FD'];
                const allUnits = [...new Set([...defaultUnits, ...knownUnitsList])].sort();
                let opts = '';
                allUnits.forEach(u => { opts += `<option value="${u}">${u}</option>`; });
                opts += `<option value="CUSTOM">+ Outra Unidade...</option>`;
                selUn.innerHTML = opts;
            }

            const modal = document.getElementById('productModal');
            if (modal) modal.classList.remove('pointer-events-none', 'opacity-0');
        }

        function closeProductModal() {
            const modal = document.getElementById('productModal');
            if (modal) modal.classList.add('pointer-events-none', 'opacity-0');
        }

        function onProdUnidadeChange() {
            const sel = document.getElementById('prodUnidadeSelect');
            const custom = document.getElementById('prodCustomUnidade');
            if (sel.value === 'CUSTOM') {
                custom.classList.remove('hidden');
                custom.focus();
            } else {
                custom.classList.add('hidden');
            }
        }

        async function handleProductSubmit(e) {
            e.preventDefault();
            const targetSector = document.getElementById('prodSetorTarget').value;
            let rawCode = document.getElementById('prodCodigo').value.trim();
            const desc = document.getElementById('prodDescricao').value.trim().toUpperCase();
            const selUn = document.getElementById('prodUnidadeSelect').value;
            const customUn = document.getElementById('prodCustomUnidade').value.trim().toUpperCase();
            const fatorConv = parseFloat(document.getElementById('prodFatorConv').value) || 1;
            const rawTags = document.getElementById('prodTags').value.trim();

            if (!rawCode || !desc) {
                showAlert("Preencha o Código e a Descrição.", "warning");
                return;
            }

            if (rawCode.length > 8) {
                showAlert("O código do produto não pode exceder 8 caracteres.", "warning");
                return;
            }

            if (/^\d+$/.test(rawCode)) {
                rawCode = rawCode.padStart(8, '0');
            }

            const unidade = (selUn === 'CUSTOM' ? customUn : selUn) || 'UN';
            const enderecoStr = document.getElementById('prodEndereco') ? document.getElementById('prodEndereco').value.trim().toUpperCase() : '';

            let tagsStr = '';
            if (rawTags) {
                tagsStr = rawTags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean).join(',');
            }

            const sb1Table = targetSector === 'INDUSTRIA' ? 'sb1_industria' : 'sb1_comercio';

            const btn = document.getElementById('btnProdSubmit');
            const origText = btn.innerText;
            btn.innerText = "Salvando..."; btn.disabled = true;

            try {
                const supabasePayload = {
                    'codigo': rawCode,
                    'descricao': desc,
                    'unidade': unidade,
                    'fator_conv': fatorConv,
                    'tags': tagsStr || null,
                    'endereco': enderecoStr || null
                };

                if (supabaseClient && navigator.onLine) {
                    let { error } = await supabaseClient.from(sb1Table).insert([supabasePayload]);
                    if (error) {
                        const legacyPayload = {
                            'Codigo': rawCode,
                            'Descr.Espec.': desc,
                            'Unidade': unidade,
                            'Fator Conv.': fatorConv,
                            'tags': tagsStr || null,
                            'endereco': enderecoStr || null
                        };
                        const res2 = await supabaseClient.from(sb1Table).insert([legacyPayload]);
                        error = res2.error;
                    }
                    if (error) {
                        showAlert(`Erro ao cadastrar produto: ${error.message}`, "error");
                        btn.innerText = origText; btn.disabled = false;
                        return;
                    }
                } else {
                    saveOfflineAction('insert', sb1Table, [supabasePayload]);
                }

                logAuditAction({
                    produto: rawCode,
                    acao: 'CADASTRO_PRODUTO',
                    detalhes: `Novo produto cadastrado: ${desc} (Unidade: ${unidade}, Endereço: ${enderecoStr || 'Sem endereço'})`,
                    modulo: 'INVENTARIO'
                });

                showAlert(`Produto ${rawCode} cadastrado com sucesso!`, "success");
                closeProductModal();

                if (targetSector === currentSector) {
                    await loadInventoryData();
                }

            } catch (e) {
                showAlert(`Erro no cadastro: ${e.message}`, "error");
            } finally {
                btn.innerText = origText; btn.disabled = false;
            }
        }

        // --- GESTÃO DE TAGS ---
        function openTagsModal(code, desc, tagsString) {
            editingTagsProductCode = code;
            document.getElementById('tagsModalProductTitle').innerText = `${code} - ${desc}`;
            
            currentProductTagsArray = tagsString ? tagsString.split(',').map(t => t.trim().toLowerCase()).filter(Boolean) : [];
            renderTagsBadges();
            
            document.getElementById('tagsModalInput').value = '';
            const modal = document.getElementById('tagsModal');
            if (modal) modal.classList.remove('pointer-events-none', 'opacity-0');
        }

        function closeTagsModal() {
            const modal = document.getElementById('tagsModal');
            if (modal) modal.classList.add('pointer-events-none', 'opacity-0');
        }

        function renderTagsBadges() {
            const container = document.getElementById('tagsModalBadges');
            if (!container) return;

            if (currentProductTagsArray.length === 0) {
                container.innerHTML = `<span class="text-xs text-slate-400 font-semibold italic">Nenhuma tag associada.</span>`;
            } else {
                let html = '';
                currentProductTagsArray.forEach((tag, idx) => {
                    html += `
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-[#002f6c]/10 text-[#002f6c] border border-[#002f6c]/20">
                            <span>${tag}</span>
                            <button type="button" onclick="removeTagAtIndex(${idx})" class="hover:text-rose-600 transition-colors" title="Remover Tag">
                                <i data-lucide="x" class="w-3.5 h-3.5"></i>
                            </button>
                        </span>
                    `;
                });
                container.innerHTML = html;
            }
            
            renderAvailableTagsBadges();
            lucide.createIcons();
        }

        function renderAvailableTagsBadges() {
            const container = document.getElementById('tagsModalAvailableBadges');
            if (!container) return;

            const available = knownTagsList.filter(t => !currentProductTagsArray.includes(t));

            if (available.length === 0) {
                container.innerHTML = `<span class="text-[10px] text-slate-400 font-semibold italic">Nenhuma outra tag cadastrada no sistema.</span>`;
                return;
            }

            let html = '';
            available.forEach(tag => {
                html += `
                    <button type="button" onclick="selectExistingTag('${tag}')" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 hover:bg-[#002f6c] hover:text-white transition-all cursor-pointer shadow-sm" title="Clique para adicionar ao produto">
                        <span>+ ${tag}</span>
                    </button>
                `;
            });
            container.innerHTML = html;
        }

        function selectExistingTag(tag) {
            if (!currentProductTagsArray.includes(tag)) {
                currentProductTagsArray.push(tag);
                renderTagsBadges();
            }
        }

        function addTagFromInput() {
            const input = document.getElementById('tagsModalInput');
            if (!input) return;
            const rawVal = input.value.trim();
            if (!rawVal) return;

            const newTags = rawVal.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
            newTags.forEach(t => {
                if (!currentProductTagsArray.includes(t)) {
                    currentProductTagsArray.push(t);
                }
            });

            input.value = '';
            renderTagsBadges();
        }

        function removeTagAtIndex(idx) {
            if (idx >= 0 && idx < currentProductTagsArray.length) {
                currentProductTagsArray.splice(idx, 1);
                renderTagsBadges();
            }
        }

        async function saveTagsModalChanges() {
            if (!editingTagsProductCode) return;
            const code = editingTagsProductCode;
            const tagsString = currentProductTagsArray.join(',');
            const sb1Table = currentSector === 'INDUSTRIA' ? 'sb1_industria' : 'sb1_comercio';

            const btn = document.getElementById('btnSaveTags');
            const origText = btn ? btn.innerText : 'Salvar Tags';
            if (btn) { btn.innerText = "Salvando..."; btn.disabled = true; }

            try {
                if (supabaseClient && navigator.onLine) {
                    let { error } = await supabaseClient.from(sb1Table)
                        .update({ tags: tagsString || null })
                        .eq('codigo', code);

                    if (error) {
                        const res2 = await supabaseClient.from(sb1Table)
                            .update({ tags: tagsString || null })
                            .eq('Codigo', code);
                        error = res2.error;
                    }

                    if (error) {
                        showAlert(`Erro ao salvar tags: ${error.message}`, "error");
                        return;
                    }
                } else {
                    saveOfflineAction('update', sb1Table, { tags: tagsString || null }, { id: code });
                }

                const prod = rawSb1Dataset.find(p => p.Codigo === code);
                if (prod) {
                    prod.tags = tagsString;
                }

                showAlert(`Tags atualizadas para o produto ${code}!`, "success");
                closeTagsModal();

                extractInventoryMetadata();
                applyInventoryFilters();

            } catch (err) {
                showAlert(`Falha: ${err.message || err}`, "error");
            } finally {
                if (btn) { btn.innerText = origText; btn.disabled = false; }
            }
        }

        // --- GESTÃO DE ENDEREÇAMENTO POR ARMAZÉM NO GALPÃO ---
        let activeAddressFocusArm = '01';
        let currentModalAddressList = [];

        function getProductAddressMap(code) {
            const cleanCode = String(code || '').trim().toUpperCase();
            const currentFilial = String(getTargetFilialForSector() || '01').padStart(2, '0');
            const map = {};

            // 1. Pega do rawSaldoDataset (que é específico da filial ativa)
            if (rawSaldoDataset) {
                rawSaldoDataset.filter(s => 
                    String(s.produto).trim().toUpperCase() === cleanCode &&
                    (s.filial === currentFilial || currentFilial === 'ALL' || isGlobalFilial(currentUser))
                ).forEach(s => {
                    const a = String(s.armazem || '01').trim().padStart(2, '0');
                    if (s.endereco) {
                        map[a] = String(s.endereco).trim();
                    }
                });
            }

            // 2. Se não achou no saldo da filial, verifica se há no SB1
            if (Object.keys(map).length === 0 && rawSb1Dataset) {
                const sbMatch = rawSb1Dataset.find(p => String(p.codigo || p.Codigo).trim().toUpperCase() === cleanCode);
                if (sbMatch) {
                    const raw = sbMatch.endereco || sbMatch.Endereco || '';
                    if (raw && raw.startsWith('{') && raw.endsWith('}')) {
                        try {
                            const parsed = JSON.parse(raw);
                            if (parsed[currentFilial] && typeof parsed[currentFilial] === 'object') {
                                Object.keys(parsed[currentFilial]).forEach(k => {
                                    map[k.padStart(2, '0')] = String(parsed[currentFilial][k]).trim();
                                });
                            } else {
                                Object.keys(parsed).forEach(k => {
                                    map[k.padStart(2, '0')] = String(parsed[k]).trim();
                                });
                            }
                        } catch(e) {}
                    } else if (raw) {
                        map['01'] = raw.trim();
                    }
                }
            }

            return map;
        }

        function getProductAddressForArmazem(code, armazem, fallbackAll = false) {
            const map = getProductAddressMap(code);
            const a = String(armazem || '01').trim().padStart(2, '0');
            if (map[a]) return map[a];
            if (fallbackAll) {
                const vals = Object.values(map).filter(Boolean);
                if (vals.length > 0) return vals[0];
            }
            return '';
        }

        function openEditAddressModal(code, desc, targetArmazem = null) {
            const cleanCode = String(code || '').trim().toUpperCase();
            const product = filteredInventoryDataset.find(p => String(p.codigo).trim().toUpperCase() === cleanCode) 
                         || (rawSb1Dataset && rawSb1Dataset.find(p => String(p.codigo || p.Codigo).trim().toUpperCase() === cleanCode));
            
            const productDesc = desc || (product ? (product.descricao || product['Descr.Espec.'] || '') : '');

            document.getElementById('editAddressProductCode').value = cleanCode;
            document.getElementById('editAddressProductTitle').innerText = `${cleanCode} - ${productDesc}`;

            const addrMap = getProductAddressMap(cleanCode);

            // Identifica todos os armazéns onde o produto tem saldo ou contagem
            const knownArmsSet = new Set(['01']);
            if (rawSaldoDataset) {
                rawSaldoDataset.filter(s => String(s.produto).trim().toUpperCase() === cleanCode).forEach(s => {
                    knownArmsSet.add(String(s.armazem || '01').trim().padStart(2, '0'));
                });
            }
            if (rawConfDataset) {
                rawConfDataset.filter(c => String(c.produto).trim().toUpperCase() === cleanCode).forEach(c => {
                    knownArmsSet.add(String(c.armazem || '01').trim().padStart(2, '0'));
                });
            }
            Object.keys(addrMap).forEach(a => knownArmsSet.add(a.padStart(2, '0')));
            if (targetArmazem) knownArmsSet.add(String(targetArmazem).trim().padStart(2, '0'));

            const sortedArms = Array.from(knownArmsSet).sort((a,b) => parseInt(a,10) - parseInt(b,10));
            currentModalAddressList = sortedArms.map(arm => ({
                armazem: arm,
                endereco: addrMap[arm] || ''
            }));

            activeAddressFocusArm = targetArmazem ? String(targetArmazem).trim().padStart(2, '0') : sortedArms[0];

            renderAddressWarehouseRows();

            const modal = document.getElementById('editAddressModal');
            if (modal) modal.classList.remove('pointer-events-none', 'opacity-0');

            setTimeout(() => {
                const targetInput = document.getElementById(`addrInput_${activeAddressFocusArm}`);
                if (targetInput) {
                    targetInput.focus();
                    targetInput.select();
                }
            }, 100);

            if (typeof lucide !== 'undefined') lucide.createIcons();
        }

        function renderAddressWarehouseRows() {
            const container = document.getElementById('editAddressWarehousesContainer');
            if (!container) return;
            container.innerHTML = '';

            currentModalAddressList.forEach(item => {
                const arm = item.armazem;
                const end = item.endereco || '';
                const isFocus = (arm === activeAddressFocusArm);

                const div = document.createElement('div');
                div.id = `addrRow_${arm}`;
                div.className = `p-2.5 rounded-2xl border ${isFocus ? 'border-amber-500 bg-amber-50/30 dark:bg-amber-950/20 ring-2 ring-amber-400/30' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'} space-y-1 transition-all`;
                div.innerHTML = `
                    <div class="flex items-center justify-between">
                        <span class="text-[11px] font-black text-[#002f6c] dark:text-blue-400 uppercase flex items-center gap-1">
                            <i data-lucide="warehouse" class="w-3.5 h-3.5"></i>
                            <span>Armazém ${arm}</span>
                        </span>
                        <span class="text-[9px] font-bold text-slate-400">Localização física</span>
                    </div>
                    <div class="relative">
                        <i data-lucide="map-pin" class="w-3.5 h-3.5 absolute left-3 top-2.5 text-amber-600"></i>
                        <input type="text" id="addrInput_${arm}" value="${end}" onfocus="setActiveAddressFocus('${arm}')" onclick="setActiveAddressFocus('${arm}')" oninput="onAddressRowInputChange('${arm}', this.value)" placeholder="Ex: RUA 02 - PRAT 04 - NIVEL 01" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2 pl-8 pr-3 text-xs font-bold text-slate-900 dark:text-white uppercase focus:ring-1 focus:ring-amber-500">
                    </div>
                `;
                container.appendChild(div);
            });

            updateActiveAddressArmLabel();
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }

        function setActiveAddressFocus(arm) {
            activeAddressFocusArm = String(arm).padStart(2, '0');
            updateActiveAddressArmLabel();
            document.querySelectorAll('[id^="addrRow_"]').forEach(el => {
                el.classList.remove('border-amber-500', 'bg-amber-50/30', 'dark:bg-amber-950/20', 'ring-2', 'ring-amber-400/30');
                el.classList.add('border-slate-200');
            });
            const targetEl = document.getElementById(`addrRow_${activeAddressFocusArm}`);
            if (targetEl) {
                targetEl.classList.remove('border-slate-200');
                targetEl.classList.add('border-amber-500', 'bg-amber-50/30', 'dark:bg-amber-950/20', 'ring-2', 'ring-amber-400/30');
            }
        }

        function updateActiveAddressArmLabel() {
            const lbl = document.getElementById('activeAddressArmLabel');
            if (lbl) lbl.innerText = `Armazém ${activeAddressFocusArm}`;
        }

        function onAddressRowInputChange(arm, val) {
            const item = currentModalAddressList.find(i => i.armazem === arm);
            if (item) {
                item.endereco = val.toUpperCase();
            }
        }

        function addWarehouseToAddressModal() {
            const arm = prompt("Digite o número do armazém para adicionar endereço (Ex: 01, 04, 50):");
            if (!arm) return;
            const cleanArm = String(arm).trim().padStart(2, '0');
            if (!currentModalAddressList.some(i => i.armazem === cleanArm)) {
                currentModalAddressList.push({ armazem: cleanArm, endereco: '' });
                currentModalAddressList.sort((a,b) => parseInt(a.armazem,10) - parseInt(b.armazem,10));
                activeAddressFocusArm = cleanArm;
                renderAddressWarehouseRows();
                setTimeout(() => {
                    const inp = document.getElementById(`addrInput_${cleanArm}`);
                    if (inp) inp.focus();
                }, 100);
            } else {
                setActiveAddressFocus(cleanArm);
                const inp = document.getElementById(`addrInput_${cleanArm}`);
                if (inp) inp.focus();
            }
        }

        function appendAddressToken(token) {
            const inp = document.getElementById(`addrInput_${activeAddressFocusArm}`);
            if (!inp) return;
            let val = inp.value.trim();
            if (val && !val.endsWith('-') && !val.endsWith(' ')) {
                val += ' - ' + token;
            } else {
                val += (val.endsWith(' ') ? '' : ' ') + token;
            }
            inp.value = val.toUpperCase();
            onAddressRowInputChange(activeAddressFocusArm, inp.value);
            inp.focus();
        }

        function clearActiveAddressInput() {
            const inp = document.getElementById(`addrInput_${activeAddressFocusArm}`);
            if (inp) {
                inp.value = '';
                onAddressRowInputChange(activeAddressFocusArm, '');
                inp.focus();
            }
        }

        function closeEditAddressModal() {
            const modal = document.getElementById('editAddressModal');
            if (modal) modal.classList.add('pointer-events-none', 'opacity-0');
        }

        async function handleSaveAddress(event) {
            if (event) event.preventDefault();
            const code = document.getElementById('editAddressProductCode').value.trim().toUpperCase();
            if (!code) return;

            const btn = document.getElementById('btnSaveAddress');
            const origText = btn ? btn.innerHTML : 'Salvar Endereço';
            if (btn) { btn.innerHTML = `<span>Salvando...</span>`; btn.disabled = true; }

            const sb1Table = currentSector === 'INDUSTRIA' ? 'sb1_industria' : 'sb1_comercio';
            const saldoTable = currentSector === 'INDUSTRIA' ? 'saldo_industria' : 'saldo_comercio';
            const enderecoTable = currentSector === 'INDUSTRIA' ? 'enderecos_industria' : 'enderecos_comercio';
            const currentFilial = String(getTargetFilialForSector() || '01').padStart(2, '0');

            const finalMap = {};
            currentModalAddressList.forEach(item => {
                const cleanArm = String(item.armazem).trim().padStart(2, '0');
                const cleanEnd = String(item.endereco || '').trim().toUpperCase();
                if (cleanEnd) {
                    finalMap[cleanArm] = cleanEnd;
                }
            });

            const jsonStr = Object.keys(finalMap).length > 0 ? JSON.stringify(finalMap) : null;
            const defaultSingleAddr = Object.values(finalMap)[0] || '';

            try {
                if (supabaseClient && navigator.onLine) {
                    // 1. Grava na tabela permanente de endereços particionada por filial e armazém
                    const endRows = Object.keys(finalMap).map(arm => ({
                        filial: currentFilial,
                        armazem: arm,
                        produto: code,
                        endereco: finalMap[arm],
                        updated_by: currentUser ? currentUser.nome : 'ALMOXARIFADO',
                        updated_at: new Date().toISOString()
                    }));
                    if (endRows.length > 0) {
                        await supabaseClient.from(enderecoTable).upsert(endRows);
                    }

                    // 2. Atualiza endereço nos saldos da filial ativa
                    for (const arm of Object.keys(finalMap)) {
                        await supabaseClient
                            .from(saldoTable)
                            .update({ 'endereco': finalMap[arm] })
                            .eq('filial', currentFilial)
                            .eq('produto', code)
                            .eq('armazem', arm);
                    }
                } else {
                    saveOfflineAction('update', enderecoTable, [{ filial: currentFilial, produto: code, endereco: jsonStr }]);
                }

                // Atualiza datasets locais
                if (rawSb1Dataset) {
                    const sbItem = rawSb1Dataset.find(p => String(p.codigo || p.Codigo).trim().toUpperCase() === code);
                    if (sbItem) {
                        sbItem.endereco = jsonStr || '';
                        sbItem.Endereco = jsonStr || '';
                    }
                }
                if (rawSaldoDataset) {
                    rawSaldoDataset.filter(s => String(s.produto).trim().toUpperCase() === code && s.filial === currentFilial).forEach(s => {
                        const a = String(s.armazem || '01').trim().padStart(2, '0');
                        s.endereco = finalMap[a] || '';
                    });
                }
                if (filteredInventoryDataset) {
                    const invItem = filteredInventoryDataset.find(p => String(p.codigo).trim().toUpperCase() === code);
                    if (invItem) {
                        invItem.endereco = jsonStr || '';
                    }
                }

                // Atualiza visualização no modal de contagem se aberto
                const currentCountCode = document.getElementById('countProductCode') ? document.getElementById('countProductCode').value : '';
                if (currentCountCode === code) {
                    const addrEl = document.getElementById('countProductAddressText');
                    if (addrEl) {
                        addrEl.innerText = defaultSingleAddr || 'Sem endereço';
                    }
                    Object.keys(finalMap).forEach(arm => {
                        const armBadgeText = document.getElementById(`armCardAddressText_${arm}`);
                        if (armBadgeText) armBadgeText.innerText = finalMap[arm] || '+ Endereço';
                    });
                }

                const auditDetails = Object.entries(finalMap).map(([a, e]) => `Arm ${a}: ${e}`).join(' | ') || 'Endereços removidos';
                logAuditAction({
                    produto: code,
                    acao: 'ALTERACAO_ENDERECO',
                    detalhes: `Endereços por armazém atualizados: ${auditDetails} (Setor: ${currentSector})`,
                    modulo: 'INVENTARIO'
                });

                showAlert(`Endereços por armazém do material ${code} salvos com sucesso!`, "success");
                closeEditAddressModal();
                renderInventoryPage();

            } catch(e) {
                showAlert(`Erro ao salvar endereço: ${e.message}`, "error");
            } finally {
                if (btn) { btn.innerHTML = origText; btn.disabled = false; }
            }
        }

        // --- GESTÃO DE FORNECEDORES ---
        function openFornecedoresModal(code, desc, fornString) {
            editingFornecedoresProductCode = code;
            document.getElementById('fornecedoresModalProductTitle').innerText = `${code} - ${desc}`;
            
            const rawArray = fornString ? fornString.split(/,|;/).map(f => f.trim()).filter(Boolean) : [];
            const uniqueMap = {};
            rawArray.forEach(f => {
                uniqueMap[f.toLowerCase()] = f;
            });
            currentProductFornecedoresArray = Object.values(uniqueMap);
            renderFornecedoresBadges();
            
            document.getElementById('fornecedoresModalInput').value = '';
            const modal = document.getElementById('fornecedoresModal');
            if (modal) modal.classList.remove('pointer-events-none', 'opacity-0');
        }

        function closeFornecedoresModal() {
            const modal = document.getElementById('fornecedoresModal');
            if (modal) modal.classList.add('pointer-events-none', 'opacity-0');
        }

        function renderFornecedoresBadges() {
            const container = document.getElementById('fornecedoresModalBadges');
            if (!container) return;

            if (currentProductFornecedoresArray.length === 0) {
                container.innerHTML = `<span class="text-xs text-slate-400 font-semibold italic">Nenhum fornecedor associado.</span>`;
            } else {
                let html = '';
                currentProductFornecedoresArray.forEach((forn, idx) => {
                    html += `
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-teal-600/10 text-teal-800 border border-teal-600/20">
                            <span>${forn}</span>
                            <button type="button" onclick="removeFornecedorAtIndex(${idx})" class="hover:text-rose-600 transition-colors" title="Remover Fornecedor">
                                <i data-lucide="x" class="w-3.5 h-3.5"></i>
                            </button>
                        </span>
                    `;
                });
                container.innerHTML = html;
            }
            
            renderAvailableFornecedoresBadges();
            lucide.createIcons();
        }

        function renderAvailableFornecedoresBadges() {
            const container = document.getElementById('fornecedoresModalAvailableBadges');
            if (!container) return;

            const selectedLower = currentProductFornecedoresArray.map(f => f.toLowerCase());
            const available = knownFornecedoresList.filter(f => !selectedLower.includes(f.toLowerCase()));

            if (available.length === 0) {
                container.innerHTML = `<span class="text-[10px] text-slate-400 font-semibold italic">Nenhum outro fornecedor cadastrado no sistema.</span>`;
                return;
            }

            let html = '';
            available.forEach(forn => {
                html += `
                    <button type="button" onclick="selectExistingFornecedor('${forn.replace(/'/g, "\\'")}')" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 hover:bg-[#002f6c] hover:text-white transition-all cursor-pointer shadow-sm" title="Clique para adicionar ao produto">
                        <span>+ ${forn}</span>
                    </button>
                `;
            });
            container.innerHTML = html;
        }

        function selectExistingFornecedor(forn) {
            const lowerList = currentProductFornecedoresArray.map(f => f.toLowerCase());
            if (!lowerList.includes(forn.toLowerCase())) {
                currentProductFornecedoresArray.push(forn);
                renderFornecedoresBadges();
            }
        }

        function addFornecedorFromInput() {
            const input = document.getElementById('fornecedoresModalInput');
            if (!input) return;
            const rawVal = input.value.trim();
            if (!rawVal) return;

            const newForns = rawVal.split(/,|;/).map(f => f.trim()).filter(Boolean);
            const lowerList = currentProductFornecedoresArray.map(f => f.toLowerCase());

            newForns.forEach(f => {
                if (!lowerList.includes(f.toLowerCase())) {
                    currentProductFornecedoresArray.push(f);
                    lowerList.push(f.toLowerCase());
                }
            });

            input.value = '';
            renderFornecedoresBadges();
        }

        function removeFornecedorAtIndex(idx) {
            if (idx >= 0 && idx < currentProductFornecedoresArray.length) {
                currentProductFornecedoresArray.splice(idx, 1);
                renderFornecedoresBadges();
            }
        }

        async function saveFornecedoresModalChanges() {
            if (!editingFornecedoresProductCode) return;
            const code = editingFornecedoresProductCode;
            const fornString = currentProductFornecedoresArray.join(', ');
            const sb1Table = currentSector === 'INDUSTRIA' ? 'sb1_industria' : 'sb1_comercio';

            const btn = document.getElementById('btnSaveFornecedores');
            const origText = btn ? btn.innerText : 'Salvar Fornecedores';
            if (btn) { btn.innerText = "Salvando..."; btn.disabled = true; }

            try {
                if (supabaseClient && navigator.onLine) {
                    let { error } = await supabaseClient.from(sb1Table)
                        .update({ fornecedores: fornString || null })
                        .eq('codigo', code);

                    if (error) {
                        const res2 = await supabaseClient.from(sb1Table)
                            .update({ fornecedores: fornString || null })
                            .eq('Codigo', code);
                        error = res2.error;
                    }

                    if (error) {
                        showAlert(`Erro ao salvar fornecedores: ${error.message}`, "error");
                        return;
                    }
                } else {
                    saveOfflineAction('update', sb1Table, { fornecedores: fornString || null }, { id: code });
                }

                const prod = rawSb1Dataset.find(p => p.Codigo === code);
                if (prod) {
                    prod.fornecedores = fornString;
                }

                showAlert(`Fornecedores atualizados para o produto ${code}!`, "success");
                closeFornecedoresModal();

                extractInventoryMetadata();
                applyInventoryFilters();

            } catch (err) {
                showAlert(`Falha: ${err.message || err}`, "error");
            } finally {
                if (btn) { btn.innerText = origText; btn.disabled = false; }
            }
        }

        // --- IMPORTAÇÃO DE SALDO ---
        function openImportSaldoModal() {
            const modal = document.getElementById('importSaldoModal');
            if (!modal) return;
            
            const fileInput = document.getElementById('importSaldoFileInput');
            if (fileInput) fileInput.value = '';
            
            const fileLabel = document.getElementById('importSaldoFileLabel');
            if (fileLabel) fileLabel.innerText = "Clique para selecionar o arquivo .csv";
            
            const progressContainer = document.getElementById('importSaldoProgressContainer');
            if (progressContainer) progressContainer.classList.add('hidden');
            
            const progressBar = document.getElementById('importSaldoProgressBar');
            if (progressBar) {
                progressBar.style.width = '0%';
                progressBar.style.backgroundColor = '';
            }
            
            const progressText = document.getElementById('importSaldoProgressText');
            if (progressText) progressText.innerText = 'Aguardando início...';
            
            const progressPercent = document.getElementById('importSaldoProgressPercent');
            if (progressPercent) progressPercent.innerText = '0%';

            const btnExecute = document.getElementById('btnExecuteImportSaldo');
            if (btnExecute) btnExecute.disabled = true;

            const activeSectorEl = document.getElementById('importSaldoActiveSector');
            const tableNameEl = document.getElementById('importSaldoTableName');
            
            const isIndustria = currentSector === 'INDUSTRIA';
            if (activeSectorEl) {
                activeSectorEl.innerText = isIndustria ? 'Indústria' : 'Comércio';
            }
            if (tableNameEl) {
                tableNameEl.innerText = isIndustria ? 'saldo_industria' : 'saldo_comercio';
            }

            modal.classList.remove('pointer-events-none', 'opacity-0');
        }

        function closeImportSaldoModal() {
            const modal = document.getElementById('importSaldoModal');
            if (modal) modal.classList.add('pointer-events-none', 'opacity-0');
        }

        let selectedImportSaldoFile = null;

        function handleImportSaldoFileSelect(e) {
            const file = e.target.files[0];
            const fileLabel = document.getElementById('importSaldoFileLabel');
            const btnExecute = document.getElementById('btnExecuteImportSaldo');
            
            if (file) {
                selectedImportSaldoFile = file;
                if (fileLabel) fileLabel.innerText = `Arquivo: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
                if (btnExecute) btnExecute.disabled = false;
            } else {
                selectedImportSaldoFile = null;
                if (fileLabel) fileLabel.innerText = "Clique para selecionar o arquivo .csv";
                if (btnExecute) btnExecute.disabled = true;
            }
        }

        async function executeImportSaldo() {
            if (!selectedImportSaldoFile) {
                showAlert("Nenhum arquivo CSV selecionado.", "warning");
                return;
            }

            const file = selectedImportSaldoFile;
            const progressContainer = document.getElementById('importSaldoProgressContainer');
            const progressBar = document.getElementById('importSaldoProgressBar');
            const progressText = document.getElementById('importSaldoProgressText');
            const progressPercent = document.getElementById('importSaldoProgressPercent');
            const btnExecute = document.getElementById('btnExecuteImportSaldo');
            const btnCancel = document.getElementById('btnCancelImportSaldo');
            const fileInput = document.getElementById('importSaldoFileInput');

            if (progressContainer) progressContainer.classList.remove('hidden');
            if (btnExecute) btnExecute.disabled = true;
            if (btnCancel) btnCancel.disabled = true;
            if (fileInput) fileInput.disabled = true;

            const tableName = currentSector === 'INDUSTRIA' ? 'saldo_industria' : 'saldo_comercio';

            const reader = new FileReader();
            reader.onload = async function(event) {
                try {
                    const text = event.target.result;
                    const lines = text.split(/\r\n|\n/).map(l => l.trim()).filter(Boolean);
                    
                    if (lines.length <= 1) {
                        throw new Error("Arquivo vazio ou sem registros válidos.");
                    }

                    const delimiter = lines[0].includes(';') ? ';' : ',';
                    const headers = lines[0].split(delimiter).map(h => h.trim().toUpperCase());
                    
                    let idxFilial = -1, idxProduto = -1, idxArmazem = -1, idxQtd = -1, idxCusto = -1, idxEndereco = -1;
                    headers.forEach((h, idx) => {
                        const clean = h.trim().toUpperCase();
                        if (clean.includes('FILIAL') || clean === 'B2_FILIAL') idxFilial = idx;
                        else if (clean.includes('PROD') || clean.includes('COD') || clean === 'B2_COD' || clean.includes('MATER')) idxProduto = idx;
                        else if (clean.includes('ARM') || clean.includes('LOC') || clean === 'B2_LOCAL' || clean.includes('DEP')) idxArmazem = idx;
                        else if (clean.includes('QTD') || clean.includes('QUANT') || clean.includes('SALDO') || clean === 'B2_QATU') idxQtd = idx;
                        else if (clean.includes('CUSTO') || clean.includes('PRECO') || clean.includes('PREÇO') || clean.includes('VALOR') || clean.includes('CM1') || clean.includes('UNIT') || clean === 'B2_CM1') idxCusto = idx;
                        else if (clean.includes('ENDER') || clean.includes('RUA') || clean === 'B2_LOCALIZ') idxEndereco = idx;
                    });

                    const hasHeader = (idxProduto !== -1 || idxArmazem !== -1 || idxQtd !== -1);
                    const startLine = hasHeader ? 1 : 0;

                    const payload = [];
                    for (let i = startLine; i < lines.length; i++) {
                        const parts = lines[i].split(delimiter);
                        if (parts.length < 2) continue;

                        let filial = '01';
                        let armazem = '01';
                        let produto = '';
                        let quantidade = 0;
                        let custo_unitario = null;
                        let endereco = '';

                        if (hasHeader) {
                            if (idxFilial !== -1 && parts[idxFilial]) filial = String(parts[idxFilial]).trim().padStart(2, '0');
                            if (idxProduto !== -1 && parts[idxProduto]) produto = String(parts[idxProduto]).trim();
                            if (idxArmazem !== -1 && parts[idxArmazem]) armazem = String(parts[idxArmazem]).trim().padStart(2, '0');
                            if (idxQtd !== -1 && parts[idxQtd]) {
                                const rawQtd = String(parts[idxQtd]).trim().replace(',', '.');
                                quantidade = parseFloat(rawQtd) || 0;
                            }
                            if (idxCusto !== -1 && parts[idxCusto]) {
                                const rawCusto = String(parts[idxCusto]).trim().replace('R$', '').trim().replace(/\./g, '').replace(',', '.');
                                const parsedCusto = parseFloat(rawCusto);
                                if (!isNaN(parsedCusto) && parsedCusto >= 0) custo_unitario = parsedCusto;
                            }
                            if (idxEndereco !== -1 && parts[idxEndereco]) {
                                endereco = String(parts[idxEndereco]).trim();
                            }
                        } else {
                            if (parts.length >= 4) {
                                filial = String(parts[0]).trim().padStart(2, '0');
                                const col1 = String(parts[1]).trim();
                                const col2 = String(parts[2]).trim();
                                const rawQtd = String(parts[3]).trim().replace(',', '.');
                                quantidade = parseFloat(rawQtd) || 0;

                                // Heurística inteligente: código de produto geralmente tem > 4 caracteres ou é o mais longo
                                if (col1.length > col2.length) {
                                    produto = col1;
                                    armazem = col2.padStart(2, '0');
                                } else {
                                    armazem = col1.padStart(2, '0');
                                    produto = col2;
                                }
                                if (parts.length >= 5) {
                                    const rawCusto = String(parts[4]).trim().replace('R$', '').trim().replace(',', '.');
                                    const parsedCusto = parseFloat(rawCusto);
                                    if (!isNaN(parsedCusto) && parsedCusto >= 0) custo_unitario = parsedCusto;
                                }
                            } else if (parts.length === 3) {
                                const col0 = String(parts[0]).trim();
                                const col1 = String(parts[1]).trim();
                                const rawQtd = String(parts[2]).trim().replace(',', '.');
                                quantidade = parseFloat(rawQtd) || 0;

                                if (col0.length > col1.length) {
                                    produto = col0;
                                    armazem = col1.padStart(2, '0');
                                } else {
                                    armazem = col0.padStart(2, '0');
                                    produto = col1;
                                }
                            }
                        }

                        // Proteção extra: se o armazem tiver mais de 4 caracteres e produto tiver menos, inverte
                        if (armazem.length > 4 && produto.length <= 4) {
                            const tmp = armazem;
                            armazem = produto.padStart(2, '0');
                            produto = tmp;
                        }

                        if (/^\d+$/.test(produto) && produto.length < 8) {
                            produto = produto.padStart(8, '0');
                        }

                        if (!produto) continue;
                        if (Math.abs(quantidade) < 0.0001) continue; // Otimização: ignora saldos zerados para evitar lentidão

                        payload.push({
                            filial,
                            produto,
                            armazem,
                            quantidade,
                            custo_unitario,
                            endereco
                        });
                    }

                    const totalItems = payload.length;
                    if (totalItems === 0) {
                        throw new Error("Nenhum registro com saldo ativo localizado no arquivo CSV.");
                    }

                    const tableName = currentSector === 'INDUSTRIA' ? 'saldo_industria' : 'saldo_comercio';

                    if (progressText) progressText.innerText = 'Limpando dados antigos do saldo...';
                    if (progressPercent) progressPercent.innerText = '5%';
                    if (progressBar) progressBar.style.width = '5%';

                    // 1. Limpa a tabela correspondente no Supabase para evitar duplicidade e zerar saldos de materiais esgotados
                    const { error: truncateError } = await supabaseClient.rpc('clear_saldo_table', {
                        p_table: tableName
                    });
                    if (truncateError) throw truncateError;

                    if (progressText) progressText.innerText = `Importando ${totalItems.toLocaleString('pt-BR')} itens...`;
                    
                    const batchSize = 500;
                    let inserted = 0;

                    for (let i = 0; i < totalItems; i += batchSize) {
                        const chunk = payload.slice(i, i + batchSize);
                        const { error: insertError } = await supabaseClient.rpc('import_saldo_lote', {
                            p_table: tableName,
                            p_rows: chunk
                        });
                        if (insertError) throw insertError;

                        inserted += chunk.length;
                        const pct = Math.min(Math.round((inserted / totalItems) * 90) + 5, 95);
                        if (progressBar) progressBar.style.width = `${pct}%`;
                        if (progressPercent) progressPercent.innerText = `${pct}%`;
                        if (progressText) progressText.innerText = `Inseridos ${inserted.toLocaleString('pt-BR')} de ${totalItems.toLocaleString('pt-BR')}...`;
                    }

                    if (progressBar) progressBar.style.width = '100%';
                    if (progressPercent) progressPercent.innerText = '100%';
                    if (progressText) progressText.innerText = 'Finalizando e atualizando tela...';

                    await new Promise(r => setTimeout(r, 300));
                    
                    showAlert(`Saldo de ${currentSector === 'INDUSTRIA' ? 'Indústria' : 'Comércio'} importado com sucesso! (${totalItems.toLocaleString('pt-BR')} itens)`, "success");
                    closeImportSaldoModal();
                    await loadInventoryData();

                } catch (err) {
                    console.error("Erro na importação:", err);
                    showAlert(`Falha ao importar saldo: ${err.message || err}`, "error");
                    
                    if (progressText) progressText.innerText = 'Erro na importação';
                    if (progressPercent) progressPercent.innerText = 'Falha';
                    if (progressBar) progressBar.style.backgroundColor = '#f43f5e';
                } finally {
                    if (btnCancel) btnCancel.disabled = false;
                    if (btnExecute) btnExecute.disabled = false;
                    if (fileInput) {
                        fileInput.disabled = false;
                        fileInput.value = '';
                    }
                    const fileLabel = document.getElementById('importSaldoFileLabel');
                    if (fileLabel) fileLabel.innerText = "Clique para selecionar o arquivo .csv";
                }
            };
            
            reader.readAsText(file);
        }

        // --- EXPORTAÇÃO EXCEL / CSV ---
        function exportInventarioExcel() {
            if (!filteredInventoryDataset || filteredInventoryDataset.length === 0) {
                showAlert("Nenhum dado para exportar.", "warning");
                return;
            }

            if (typeof XLSX === 'undefined') {
                showAlert("Biblioteca XLSX não carregada.", "error");
                return;
            }

            const exportData = filteredInventoryDataset.map(item => ({
                "Código": item.codigo,
                "Descrição": item.descricao,
                "Unidade": item.unidade,
                "Saldo Sistema": item.quantidade,
                "Qtd Contada": item.hasCount ? item.qtd_contada : "",
                "Divergência": item.hasCount ? item.divergencia : "",
                "Status": item.status,
                "Tags": item.tags,
                "Fornecedores": item.fornecedores,
                "Fator Conv.": item.fatorConv
            }));

            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Inventário");

            const today = new Date().toISOString().split('T')[0];
            XLSX.writeFile(wb, `Inventario_${currentSector}_${today}.xlsx`);
            showAlert("Planilha exportada com sucesso!", "success");
        }

        // --- IMPRESSÃO DE FICHA DE PALETE EM FOLHA A4 COM FRACIONAMENTO DE QUANTIDADE ---

        let currentA4PalletData = null;

        function openA4PalletPrintModalFromInventario(codigo, descricao, unidade, totalQtd, armazem) {
            const f = String(typeof currentSelectedFilial !== 'undefined' && currentSelectedFilial ? currentSelectedFilial : '01').padStart(2, '0');
            const invArmEl = document.getElementById('invFilterArmazem');
            const a = String(armazem || (invArmEl && invArmEl.value !== 'ALL' ? invArmEl.value : '01')).padStart(2, '0');
            const p = String(codigo || '').trim().toUpperCase();
            const desc = String(descricao || p).trim().toUpperCase();
            const u = String(unidade || 'UN').trim().toUpperCase();
            const q = parseFloat(totalQtd) || 0;

            const initialLots = [{
                id: 'inv_1',
                filial: f,
                armazem: a,
                produto: p,
                lote: '',
                data_fabricacao: '',
                data_validade: '',
                quantidade: q,
                embalagem: 'PALETE 1/1',
                observacao: ''
            }];

            currentA4PalletData = {
                filial: f,
                armazem: a,
                produto: p,
                descricao: desc,
                unidade: u,
                lotes: initialLots
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
            if (unEl) unEl.innerText = u;
            if (u1) u1.innerText = u;
            if (u2) u2.innerText = u;

            const inputTotal = document.getElementById('a4InputTotalQtd');
            const inputPerPallet = document.getElementById('a4InputQtdPorPallet');
            if (inputPerPallet) inputPerPallet.value = '';

            // Popula o seletor de lote a fracionar
            populateA4SplitLoteSelect();

            // Popula o seletor de paletes para filtro rápido na folha A4
            refreshA4QuickPalletFilterSelect();

            const headerInput = document.getElementById('a4PalletHeaderInput');
            if (headerInput) {
                headerInput.value = 'IDENTIFICAÇÃO DE PALETE / ESTOQUE';
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
                const loteLabel = lot.lote ? `Lote: ${lot.lote}` : 'ESTOQUE GERAL';
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
            let opts = `<option value="ALL">📋 Imprimir Todos os Paletes / Volumes (${lots.length})</option>`;
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
                const chks = document.querySelectorAll('.a4-lot-chk');
                chks.forEach(c => c.checked = true);
            } else {
                const targetLot = lots.find(l => String(l.id) === String(val));
                if (targetLot) {
                    totalInput.value = parseFloat(targetLot.quantidade) || '';
                    const chks = document.querySelectorAll('.a4-lot-chk');
                    chks.forEach(c => c.checked = (String(c.value) === String(val)));
                }
            }

            onA4QuantityInputsChange();
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
                    summaryText.innerHTML = `📦 Cada lote/volume será fracionado em paletes com até <b>${perPallet.toLocaleString('pt-BR')} ${u}</b>`;
                } else {
                    summaryText.innerText = `📦 Mantém cada item em 1 palete com suas quantidades atuais`;
                }
            } else {
                const targetLot = currentA4PalletData.lotes.find(l => String(l.id) === String(splitMode));
                const loteNome = targetLot && targetLot.lote ? `Lote ${targetLot.lote}` : 'Item Selecionado';

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
                                embalagem: `PALETE ${i}/${totalSlices}`
                            });
                        }

                        if (remainder > 0.0001) {
                            newLots.push({
                                ...lot,
                                id: `${lot.id}_split_${totalSlices}_${Date.now()}`,
                                quantidade: remainder,
                                embalagem: `PALETE ${totalSlices}/${totalSlices} (RESTO)`
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
                            embalagem: `PALETE ${i}/${totalSlices}`
                        });
                    }

                    if (remainder > 0.0001) {
                        splitLots.push({
                            ...targetLot,
                            id: `${targetLot.id}_split_${totalSlices}_${Date.now()}`,
                            quantidade: remainder,
                            embalagem: `PALETE ${totalSlices}/${totalSlices} (RESTO)`
                        });
                    }
                } else {
                    splitLots.push({
                        ...targetLot,
                        quantidade: finalTotal,
                        embalagem: targetLot.embalagem || 'PALETE 1/1'
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

                const palletDisplay = lot.embalagem ? lot.embalagem : 'PALETE';
                const isChecked = checkedIds ? checkedIds.includes(String(lot.id)) : true;

                itemDiv.innerHTML = `
                    <div class="flex items-center space-x-3">
                        <input type="checkbox" id="a4_lot_chk_${lot.id}" value="${lot.id}" ${isChecked ? 'checked' : ''} onchange="onA4LotCheckboxChange()" class="a4-lot-chk w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer">
                        <div>
                            <span class="font-black text-xs text-slate-900 dark:text-white">${lot.lote ? `Lote: ${lot.lote}` : 'ESTOQUE GERAL'}</span>
                            <span class="text-[11px] font-extrabold text-indigo-600 dark:text-indigo-400 ml-1.5">[${palletDisplay}]</span>
                            <span class="text-[11px] text-slate-500 font-bold ml-1.5">• Qtd: ${Number(lot.quantidade || 0).toLocaleString('pt-BR')} ${currentA4PalletData.unidade || 'UN'}</span>
                        </div>
                    </div>
                    <div class="flex items-center space-x-2">
                        <span class="text-xs font-black text-slate-800 dark:text-slate-200 font-mono">${lot.data_validade ? `Val: ${lot.data_validade}` : ''}</span>
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

            const desc = currentA4PalletData.descricao || produto;
            const unidade = currentA4PalletData.unidade || 'UN';

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
                                            <p style="margin: 5px 0 0 0; font-size: 11.5pt; font-weight: 900; color: #000000;">FILIAL: ${filial} &nbsp;|&nbsp; ARMAZÉM: ${armazem}</p>
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
                                            ${lot.data_fabricacao ? `<span>• FAB: <b>${lot.data_fabricacao}</b></span>` : ''}
                                            ${lot.data_validade ? `<span>• VAL: <b>${lot.data_validade}</b></span>` : ''}
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
                        rowsHtml += `
                            <tr>
                                <td style="font-family: monospace, Courier, sans-serif; font-size: 12pt; font-weight: 900; word-break: break-word;">${l.lote || 'S/ LOTE'}</td>
                                <td style="font-size: 11pt; font-weight: 900; color: #002f6c; text-transform: uppercase;">${l.embalagem || 'PALETE'}</td>
                                <td style="text-align: right; font-size: 13pt; font-weight: 900; white-space: nowrap;">${Number(l.quantidade || 0).toLocaleString('pt-BR')} ${unidade}</td>
                                <td style="text-align: center; font-size: 11pt; font-weight: 800; white-space: nowrap;">${l.data_fabricacao || '-'}</td>
                                <td style="text-align: center; font-size: 13pt; font-weight: 900; white-space: nowrap;">${l.data_validade || '-'}</td>
                                <td style="text-align: center; font-size: 10pt; font-weight: 900; color: #059669;">ESTOQUE</td>
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
                                        <p style="margin: 5px 0 0 0; font-size: 11.5pt; font-weight: 900; color: #000000;">FILIAL: ${filial} &nbsp;|&nbsp; ARMAZÉM: ${armazem}</p>
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

            document.body.classList.add('printing-a4');
            window.print();

            setTimeout(() => {
                document.body.classList.remove('printing-a4');
            }, 1000);
        }

        let inventoryRealtimeChannel = null;
        function initInventoryRealtime() {
            if (!supabaseClient) return;
            if (inventoryRealtimeChannel) {
                try { supabaseClient.removeChannel(inventoryRealtimeChannel); } catch(e) {}
            }
            
            const countTable = currentSector === 'INDUSTRIA' ? 'contagem_industria' : 'contagem_comercio';
            
            inventoryRealtimeChannel = supabaseClient
                .channel(`inventory_realtime_${currentSector}_${Date.now()}`)
                .on('postgres_changes', { event: '*', schema: 'public', table: countTable }, (payload) => {
                    console.log("[Realtime] Nova contagem sincronizada:", payload);
                    loadInventoryData(true);
                })
                .subscribe();
        }

        window.onload = async function() {
            const user = await checkAuth('inventario');
            if (!user) return;

            initFilialFilterUI();
            await loadInventoryData();
            initInventoryRealtime();

            // Auto-atualização ao reativar aba/janela no PC
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden && navigator.onLine) {
                    loadInventoryData(true);
                }
            });
            window.addEventListener('focus', () => {
                if (navigator.onLine) {
                    loadInventoryData(true);
                }
            });

            // Polling de sincronização em segundo plano a cada 20 segundos
            setInterval(() => {
                if (!document.hidden && navigator.onLine) {
                    loadInventoryData(true);
                }
            }, 20000);
        };
