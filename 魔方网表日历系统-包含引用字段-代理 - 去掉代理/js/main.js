/**
 * 日历系统主逻辑
 */
document.addEventListener('DOMContentLoaded', function() {
    // DOM元素
    const loginSection = document.getElementById('loginSection');
    const mainContent = document.getElementById('mainContent');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const userInfo = document.getElementById('userInfo');
    const userNameSpan = document.getElementById('userName');
    const serverSelect = document.getElementById('serverSelect');
    const statusBar = document.getElementById('statusBar');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const calendarEl = document.getElementById('calendar');
    const refreshBtn = document.getElementById('refreshBtn');
    const addEventBtn = document.getElementById('addEventBtn');
    const filterResponsible = document.getElementById('filterResponsible');
    const filterPriority = document.getElementById('filterPriority');
    const filterStatus = document.getElementById('filterStatus');
    const legend = document.getElementById('legend');
    
    // 模态框相关元素
    const eventDetailModal = document.getElementById('eventDetailModal');
    const eventFormModal = document.getElementById('eventFormModal');
    const closeEventDetailModal = document.getElementById('closeEventDetailModal');
    const closeEventFormModal = document.getElementById('closeEventFormModal');
    const closeDetailBtn = document.getElementById('closeDetailBtn');
    const cancelEventBtn = document.getElementById('cancelEventBtn');
    const saveEventBtn = document.getElementById('saveEventBtn');
    const deleteEventBtn = document.getElementById('deleteEventBtn');
    const eventForm = document.getElementById('eventForm');
    const eventFormTitle = document.getElementById('eventFormTitle');
    const eventResponsibleSelect = document.getElementById('eventResponsible');
    const eventHostSelect = document.getElementById('eventHost');
    // 多选下拉（自定义组件）相关元素
    const participantsToggle = document.getElementById('eventParticipantsToggle');
    const participantsDropdown = document.getElementById('eventParticipantsDropdown');
    const participateDeptToggle = document.getElementById('eventParticipateDeptToggle');
    const participateDeptDropdown = document.getElementById('eventParticipateDeptDropdown');
    const eventRecorderSelect = document.getElementById('eventRecorder');
    const eventDepartmentSelect = document.getElementById('eventDepartment');
    
    // 日历实例
    let calendar;
    
    // 当前过滤条件
    let currentFilters = {
        responsibleId: '',
        priority: '',
        status: ''
    };
    
    // 当前选中的事件
    let selectedEvent = null;

    // 多选下拉当前选中值（ID 列表）
    let selectedParticipantIds = [];
    let selectedParticipateDeptValues = [];
    
    // 初始化
    init();
    
    /**
     * 初始化应用
     */
    async function init() {
    // 恢复登录状态
    const loginResult = magicFluApi.restoreLogin();
    
    // 获取服务器类型
    const serverType = localStorage.getItem('mf_server_type') || 'internal';
    magicFluApi.setServerType(serverType);
    
    // 更新服务器选择下拉框
    serverSelect.value = serverType;
    
    if (loginResult.success) {
        showMainContent(loginResult.userInfo);
        await initializeCalendar();
    } else {
        showLoginSection();
    }
    
    bindEvents();
}
    
    
    /**
     * 绑定事件监听器
     */
    function bindEvents() {
        // 登录按钮
        loginBtn.addEventListener('click', handleLogin);
        
        // 回车登录
        usernameInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') handleLogin();
        });
        
        passwordInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') handleLogin();
        });
        
        // 退出按钮
        logoutBtn.addEventListener('click', handleLogout);
        
        // 服务器选择
serverSelect.addEventListener('change', function() {
    const serverType = this.value; // 'internal' 或 'external'
    magicFluApi.setServerType(serverType);
    localStorage.setItem('mf_server_type', serverType);
    
    // 如果已登录，需要重新登录到新服务器
    if (magicFluApi.userInfo) {
        showStatus('已切换服务器，请重新登录', 'error');
        handleLogout();
    }
});

        

        // 刷新按钮
        refreshBtn.addEventListener('click', refreshCalendar);
        
        // 添加事件按钮：打开空表单并预填当前时间为开始/结束（默认 +1 小时）
        addEventBtn.addEventListener('click', () => {
            const now = new Date();
            const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);
            openAddEventForm(now, inOneHour);
        });
        
        // 过滤器变化
        filterResponsible.addEventListener('change', applyFilters);
        filterPriority.addEventListener('change', applyFilters);
        filterStatus.addEventListener('change', applyFilters);
        
        // 模态框关闭按钮
        closeEventDetailModal.addEventListener('click', () => hideModal(eventDetailModal));
        closeEventFormModal.addEventListener('click', () => hideModal(eventFormModal));
        closeDetailBtn.addEventListener('click', () => hideModal(eventDetailModal));
        cancelEventBtn.addEventListener('click', () => hideModal(eventFormModal));
        
        // 保存事件按钮
        saveEventBtn.addEventListener('click', saveEvent);
        
        // 删除事件按钮（当前不支持删除，隐藏按钮）
        if (deleteEventBtn) {
            deleteEventBtn.style.display = 'none';
            // 如未来支持删除，可在此处绑定事件：deleteEventBtn.addEventListener('click', deleteEvent);
        }
        
        // 点击模态框外部关闭
        window.addEventListener('click', function(event) {
            if (event.target === eventDetailModal) {
                hideModal(eventDetailModal);
            }
            if (event.target === eventFormModal) {
                hideModal(eventFormModal);
            }
            // 收起多选下拉
            if (event.target === eventFormModal || event.target === eventDetailModal) {
                closeAllMultiSelectDropdowns();
            }
        });
    }
    
    /**
     * 处理登录
     */
    async function handleLogin() {
        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();
        
        if (!username || !password) {
            showStatus('请输入用户名和密码', 'error');
            return;
        }
        
        showLoading(true);
        
        const result = await magicFluApi.login(username, password);
        
        showLoading(false);
        
        if (result.success) {
            showStatus('登录成功', 'success');
            showMainContent(result.userInfo);
            await initializeCalendar();
        } else {
            showStatus(result.message, 'error');
        }
    }
    
    /**
     * 处理退出
     */
    function handleLogout() {
        magicFluApi.clearStoredAuth();
        showLoginSection();
        showStatus('已退出登录', 'success');
    }
    
    /**
     * 显示登录界面
     */
    function showLoginSection() {
        loginSection.style.display = 'flex';
        mainContent.style.display = 'none';
        userInfo.style.display = 'none';
        
        // 清空输入
        usernameInput.value = '';
        passwordInput.value = '';
    }
    
    /**
     * 显示主内容界面
     */
    function showMainContent(user) {
        loginSection.style.display = 'none';
        mainContent.style.display = 'block';
        // 显示右上角用户信息区域
        userInfo.style.display = 'flex';
        userNameSpan.textContent = user.nickname || user.username;
    }
    
    /**
     * 显示状态消息
     */
    function showStatus(message, type = 'success') {
        statusBar.textContent = message;
        statusBar.className = 'status-bar ' + (type === 'error' ? 'error' : 'success');
        statusBar.style.display = 'block';
        
        // 3秒后自动隐藏
        setTimeout(() => {
            statusBar.style.display = 'none';
        }, 3000);
    }
    
    /**
     * 显示/隐藏加载动画
     */
    function showLoading(show) {
        loadingOverlay.style.display = show ? 'flex' : 'none';
    }
    
    /**
     * 显示模态框
     */
    function showModal(modal) {
        modal.style.display = 'flex';
    }
    
    /**
     * 隐藏模态框
     */
    function hideModal(modal) {
        modal.style.display = 'none';
    }
    
    /**
     * 初始化日历
     */
    async function initializeCalendar() {
        showLoading(true);
        
        try {
            // 加载人员信息
            await loadPersonnel();
            
            // 初始化日历
            calendar = new FullCalendar.Calendar(calendarEl, {
                locale: 'zh-cn',
                initialView: 'dayGridMonth',
                headerToolbar: {
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth' // 仅保留月视图
                },
                buttonText: {
                    today: '今天',
                    month: '月',
                    week: '周',
                    day: '日'
                },
                // 禁用拖拽/调整事件以防止通过拖动修改日程
                editable: false,
                eventStartEditable: false,
                eventDurationEditable: false,
                selectable: true,
                selectMirror: true,
                // 限制每天最多显示 7 条事件，超出则显示“+n”折叠
                dayMaxEvents: 7,
                dayMaxEventRows: 7, // 同时设置最大行数为 7
                expandRows: false,
                // 事件最小行高，帮助计算折叠阈值
                eventMinHeight: 20,
                // 排序：按开始时间升序，同一开始时间按创建时间顺序
                eventOrder: 'start,createdTime',
                events: async function(fetchInfo, successCallback, failureCallback) {
                    try {
                        // 构建查询条件（包含当前筛选）
                        const bq = magicFluApi.buildTaskQuery({
                            startDate: fetchInfo.startStr,
                            endDate: fetchInfo.endStr,
                            responsibleId: currentFilters.responsibleId,
                            priority: currentFilters.priority,
                            status: currentFilters.status
                        });
                        
                        // 获取工作任务
                        const result = await magicFluApi.getWorkTasks(0, -1, bq);
                        
                        if (result.success) {
                            // 转换为日历事件
                            const events = magicFluApi.convertToCalendarEvents(result.data);
                            successCallback(events);
                            
                            // 更新图例
                            updateLegend();
                            
                            // 更新负责人过滤器
                            updateResponsibleFilter();
                        } else {
                            failureCallback(result.message);
                        }
                    } catch (error) {
                        failureCallback(error.message);
                    }
                },
                eventClick: function(info) {
                    selectedEvent = info.event;
                    showEventDetails(selectedEvent);
                },
                select: function(info) {
                    openAddEventForm(info.start, info.end);
                }
            });
            
            calendar.render();
            
            // 加载初始数据
            await refreshCalendar();
            
            showLoading(false);
        } catch (error) {
            showLoading(false);
            showStatus('初始化日历失败: ' + error.message, 'error');
        }
    }
    
    /**
     * 加载人员信息
     */
    async function loadPersonnel() {
        const result = await magicFluApi.getPersonnel(0, -1);
        
        if (result.success) {
            // 更新负责人下拉选项
            updateResponsibleSelect();
        } else {
            showStatus('加载人员信息失败: ' + result.message, 'error');
        }
    }
    
    /**
     * 刷新日历数据
     */
    async function refreshCalendar() {
        if (calendar) {
            calendar.refetchEvents();
            showStatus('数据已刷新', 'success');
        }
    }
    
    /**
     * 应用过滤器
     */
    function applyFilters() {
        // 获取当前过滤器值并保存
        currentFilters = {
            responsibleId: filterResponsible.value,
            priority: filterPriority.value,
            status: filterStatus.value
        };
        
        // 重新获取数据
        if (calendar) {
            calendar.refetchEvents();
        }
    }
    
    /**
     * 打开添加事件表单
     */
    function openAddEventForm(start, end) {
        eventFormTitle.textContent = '添加日程';
        eventForm.reset();
        document.getElementById('eventId').value = '';
        
        // 设置默认时间
        if (start) {
            const startStr = start.toISOString().slice(0, 16);
            document.getElementById('eventStart').value = startStr;
        }
        
        if (end) {
            const endStr = end.toISOString().slice(0, 16);
            document.getElementById('eventEnd').value = endStr;
        }
        
        showModal(eventFormModal);
    }
    
    /**
     * 打开编辑事件表单
     */
    function openEditEventForm(event) {
        eventFormTitle.textContent = '编辑日程';
        eventForm.reset();
        
        // 填充表单数据
        document.getElementById('eventId').value = event.id;
        document.getElementById('eventTitle').value = event.title;
        document.getElementById('eventContent').value = event.extendedProps.content;
        
        // 格式化时间
        const startDate = new Date(event.start);
        const endDate = new Date(event.end);
        
        document.getElementById('eventStart').value = startDate.toISOString().slice(0, 16);
        document.getElementById('eventEnd').value = endDate.toISOString().slice(0, 16);
        
        // 设置负责人
        if (event.extendedProps.responsibleId) {
            document.getElementById('eventResponsible').value = event.extendedProps.responsibleId;
        }
        
        // 设置优先级
        if (event.extendedProps.priority) {
            document.getElementById('eventPriority').value = event.extendedProps.priority;
        }
        
        // 设置状态
        if (event.extendedProps.status) {
            document.getElementById('eventStatus').value = event.extendedProps.status;
        }
        
        showModal(eventFormModal);
    }
    
    /**
     * 保存事件
     */
    async function saveEvent() {
        // 验证表单
        if (!eventForm.checkValidity()) {
            eventForm.reportValidity();
            return;
        }
        
        // 收集表单数据
        const formData = {
            title: document.getElementById('eventTitle').value.trim(),
            content: document.getElementById('eventContent').value.trim(),
            startTime: document.getElementById('eventStart').value.replace('T', ' '),
            endTime: document.getElementById('eventEnd').value.replace('T', ' '),
            responsibleId: document.getElementById('eventResponsible').value,
            priority: document.getElementById('eventPriority').value,
            status: document.getElementById('eventStatus').value,
            department: eventDepartmentSelect ? eventDepartmentSelect.value : '',
            participateDept: selectedParticipateDeptValues,
            hostId: eventHostSelect ? eventHostSelect.value : '',
            participantIds: selectedParticipantIds,
            recorderId: eventRecorderSelect ? eventRecorderSelect.value : ''
        };
        
        // 验证时间
        const startTime = new Date(formData.startTime);
        const endTime = new Date(formData.endTime);
        
        if (endTime <= startTime) {
            showStatus('结束时间必须晚于开始时间', 'error');
            return;
        }
        
        showLoading(true);
        
        try {
            // 构建请求数据
            const taskData = magicFluApi.buildTaskData(formData);
            
            // 发送请求
            const result = await magicFluApi.addWorkTask(taskData);
            
            showLoading(false);
            
            if (result.success) {
                showStatus('日程添加成功', 'success');
                hideModal(eventFormModal);
                refreshCalendar();
            } else {
                showStatus('添加失败: ' + result.message, 'error');
            }
        } catch (error) {
            showLoading(false);
            showStatus('保存失败: ' + error.message, 'error');
        }
    }
    
    /**
     * 删除事件
     */
    async function deleteEvent() {
        if (!selectedEvent) return;
        
        if (!confirm('确定要删除这个日程吗？')) {
            return;
        }
        
        showLoading(true);
        
        try {
            // 注意：魔方网表API没有提供删除接口，这里只是示例
            // 实际使用时需要根据魔方网表的删除API进行调整
            showLoading(false);
            showStatus('删除功能需要调用魔方网表的删除API实现', 'error');
            hideModal(eventDetailModal);
        } catch (error) {
            showLoading(false);
            showStatus('删除失败: ' + error.message, 'error');
        }
    }
    
    /**
     * 显示事件详情
     */
    function showEventDetails(event) {
        const props = event.extendedProps;
        
        let html = `
            <p><strong>任务编号：</strong>${props.taskNumber || '无'}</p>
            <p><strong>源任务编码：</strong>${props.sourceTaskCode || '无'}</p>
            <p><strong>任务名称：</strong>${event.title}</p>
            <p><strong>任务内容：</strong>${props.content || '无'}</p>
            <p><strong>负责人：</strong>${props.responsible || '未指定'}</p>
            <p><strong>上级：</strong>${props.supervisor || '未指定'}</p>
            <p><strong>开始时间：</strong>${formatDateTime(event.start)}</p>
            <p><strong>结束时间：</strong>${formatDateTime(event.end)}</p>
            <p><strong>优先级：</strong>${props.priorityText}</p>
            <p><strong>当前状态：</strong>${props.statusText}</p>
            <p><strong>责任部门：</strong>${props.department || '未指定'}</p>
            <p><strong>参与部门：</strong>${props.participateDepartments || '未指定'}</p>
            <p><strong>主持人：</strong>${props.host || '未指定'}</p>
            <p><strong>参会人员：</strong>${props.participants || '未指定'}</p>
            <p><strong>记录人：</strong>${props.recorder || '未指定'}</p>
            <p><strong>创建人：</strong>${props.creator || '未知'}</p>
            <p><strong>创建人ID：</strong>${props.creatorNum || '未知'}</p>
            <p><strong>创建时间：</strong>${formatDateTime(props.createdTime)}</p>
            <p><strong>修改人：</strong>${props.updater || '未知'}</p>
            <p><strong>修改人ID：</strong>${props.updaterNum || '未知'}</p>
            <p><strong>最后更新：</strong>${formatDateTime(props.updatedTime)}</p>
        `;
        
        document.getElementById('eventDetailContent').innerHTML = html;
        showModal(eventDetailModal);
    }
    
    /**
     * 更新负责人下拉选择器
     */
    function updateResponsibleSelect() {
        const options = magicFluApi.buildResponsibleOptions();
        
        // 负责人的下拉（单选，首项是“请选择负责人”）
        while (eventResponsibleSelect.options.length > 1) {
            eventResponsibleSelect.remove(1);
        }
        options.forEach(option => {
            const opt = document.createElement('option');
            opt.value = option.id;
            opt.textContent = option.name;
            eventResponsibleSelect.appendChild(opt);
        });

        // 主持人下拉（单选，首项是“请选择主持人”）
        if (eventHostSelect) {
            while (eventHostSelect.options.length > 1) {
                eventHostSelect.remove(1);
            }
            options.forEach(option => {
                const opt = document.createElement('option');
                opt.value = option.id;
                opt.textContent = option.name;
                eventHostSelect.appendChild(opt);
            });
        }

        // 记录人下拉（单选，首项是“请选择记录人”）
        if (eventRecorderSelect) {
            while (eventRecorderSelect.options.length > 1) {
                eventRecorderSelect.remove(1);
            }
            options.forEach(option => {
                const opt = document.createElement('option');
                opt.value = option.id;
                opt.textContent = option.name;
                eventRecorderSelect.appendChild(opt);
            });
        }

        // 参会人员多选下拉（带搜索，已移除全选）
        if (participantsDropdown) {
            // 构建头部（搜索）与选项容器
            participantsDropdown.innerHTML = `
                <div class="multi-select-header">
                    <input type="text" class="multi-select-search" id="participantsSearch" placeholder="搜索参会人员">
                </div>
                <div class="multi-select-options"></div>
            `;
            const optionsContainer = participantsDropdown.querySelector('.multi-select-options');
            options.forEach(option => {
                const item = document.createElement('div');
                item.className = 'multi-select-option';
                item.dataset.name = option.name ? option.name.toLowerCase() : '';

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = option.id;
                const cbId = `ms_participant_${option.id}`;
                checkbox.id = cbId;
                checkbox.checked = selectedParticipantIds.includes(option.id);
                checkbox.addEventListener('change', () => {
                    if (checkbox.checked) {
                        if (!selectedParticipantIds.includes(option.id)) {
                            selectedParticipantIds.push(option.id);
                        }
                    } else {
                        selectedParticipantIds = selectedParticipantIds.filter(id => id !== option.id);
                    }
                    updateMultiSelectSummary(participantsToggle, selectedParticipantIds.length, '请选择参会人员');
                    updateSelectedParticipants(options, selectedParticipantIds);

                    // 更新 可见项的选中状态检查（不再有全选控件）
                    const visible = Array.from(optionsContainer.querySelectorAll('.multi-select-option'))
                        .filter(o => o.style.display !== 'none');
                    const allChecked = visible.length > 0 && visible.every(o => o.querySelector('input[type=checkbox]').checked);
                    // no-op
                });

                const labelEl = document.createElement('label');
                labelEl.htmlFor = cbId;
                labelEl.className = 'multi-select-label';
                labelEl.textContent = option.name;
                labelEl.title = option.name;

                item.appendChild(checkbox);
                item.appendChild(labelEl);
                optionsContainer.appendChild(item);
            });

            // 搜索功能
            const searchInput = participantsDropdown.querySelector('#participantsSearch');
            searchInput.addEventListener('input', () => {
                const q = searchInput.value.trim().toLowerCase();
                optionsContainer.querySelectorAll('.multi-select-option').forEach(opt => {
                    const name = opt.dataset.name || '';
                    opt.style.display = name.includes(q) ? '' : 'none';
                });

            });

            // (已移除全选控件)

            // 初始文案
            updateMultiSelectSummary(participantsToggle, selectedParticipantIds.length, '请选择参会人员');
        }

        // 部门下拉（责任部门单选，参与部门多选复选框）
        const deptOptions = magicFluApi.buildDepartmentOptions();
        if (eventDepartmentSelect) {
            while (eventDepartmentSelect.options.length > 1) {
                eventDepartmentSelect.remove(1);
            }
            deptOptions.forEach(option => {
                const opt = document.createElement('option');
                opt.value = option.id;
                opt.textContent = option.name;
                eventDepartmentSelect.appendChild(opt);
            });
        }
        if (participateDeptDropdown) {
            participateDeptDropdown.innerHTML = `
                <div class="multi-select-header">
                    <input type="text" class="multi-select-search" id="participateDeptSearchTop" placeholder="搜索部门">
                </div>
                <div class="multi-select-options"></div>
            `;
            const optionsContainer = participateDeptDropdown.querySelector('.multi-select-options');
            deptOptions.forEach(option => {
                const item = document.createElement('div');
                item.className = 'multi-select-option';
                item.dataset.name = option.name ? option.name.toLowerCase() : '';

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = option.id;
                const cbId = `ms_dept_${option.id}`;
                checkbox.id = cbId;
                checkbox.checked = selectedParticipateDeptValues.includes(option.id);
                checkbox.addEventListener('change', () => {
                    if (checkbox.checked) {
                        if (!selectedParticipateDeptValues.includes(option.id)) {
                            selectedParticipateDeptValues.push(option.id);
                        }
                    } else {
                        selectedParticipateDeptValues = selectedParticipateDeptValues.filter(v => v !== option.id);
                    }
                    updateMultiSelectSummary(participateDeptToggle, selectedParticipateDeptValues.length, '请选择参与部门');
                    updateSelectedDepartments(deptOptions, selectedParticipateDeptValues);

                    const visible = Array.from(optionsContainer.querySelectorAll('.multi-select-option')).filter(o => o.style.display !== 'none');
                    const allChecked = visible.length > 0 && visible.every(o => o.querySelector('input[type=checkbox]').checked);
                    // select-all UI removed; no-op

                });

                const labelEl = document.createElement('label');
                labelEl.htmlFor = cbId;
                labelEl.className = 'multi-select-label';
                labelEl.textContent = option.name;
                labelEl.title = option.name;

                item.appendChild(checkbox);
                item.appendChild(labelEl);
                optionsContainer.appendChild(item);
            });

            // 搜索功能
            const searchInput = participateDeptDropdown.querySelector('#participateDeptSearchTop');
            searchInput.addEventListener('input', () => {
                const q = searchInput.value.trim().toLowerCase();
                optionsContainer.querySelectorAll('.multi-select-option').forEach(opt => {
                    const name = opt.dataset.name || '';
                    opt.style.display = name.includes(q) ? '' : 'none';
                });
                const visible = Array.from(optionsContainer.querySelectorAll('.multi-select-option')).filter(o => o.style.display !== 'none');
                // select-all 已移除，运行时仅用于统计或其他逻辑（无操作）
            });

            // (全选功能已移除)


            updateMultiSelectSummary(participateDeptToggle, selectedParticipateDeptValues.length, '请选择参与部门');
        }
    }
    
    /**
     * 更新负责人过滤器
     */
    function updateResponsibleFilter() {
        const options = magicFluApi.buildResponsibleOptions();
        
        // 清空现有选项（保留第一个空选项）
        while (filterResponsible.options.length > 1) {
            filterResponsible.remove(1);
        }
        
        // 添加新选项
        options.forEach(option => {
            const opt = document.createElement('option');
            opt.value = option.id;
            opt.textContent = option.name;
            filterResponsible.appendChild(opt);
        });
    }
    
    /**
     * 更新图例
     */
    function updateLegend() {
        const colorMap = magicFluApi.getResponsibleColorMap();
        
        let html = '<strong>负责人颜色：</strong>';
        
        for (const id in colorMap) {
            const item = colorMap[id];
            html += `
                <div class="legend-item">
                    <div class="color-box" style="background-color: ${item.color};"></div>
                    <span>${item.name}</span>
                </div>
            `;
        }
        
        legend.innerHTML = html;
    }

    /**
     * 更新多选下拉按钮上的摘要文字
     */
    function updateMultiSelectSummary(toggleBtn, count, placeholder) {
        if (!toggleBtn) return;
        if (!count) {
            toggleBtn.textContent = placeholder;
        } else {
            toggleBtn.textContent = `${placeholder}（已选 ${count} 个）`;
        }
    }

    // 新增：更新已选部门显示
    function updateSelectedDepartments(deptOptions, selectedValues) {
        const container = document.getElementById('selectedDepartments');
        if (!container) return;
        
        // 清空现有内容
        container.innerHTML = '';
        
        if (selectedValues.length === 0) {
            container.style.display = 'none';
            return;
        }
        
        container.style.display = 'flex';
        
        // 创建已选部门标签
        selectedValues.forEach(value => {
            const deptName = deptOptions.find(d => d.id === value)?.name || value;
            const tag = document.createElement('span');
            tag.className = 'selected-dept-tag';
            tag.textContent = deptName;

            // 点击标签展开下拉并滚动到对应项
            tag.onclick = () => {
                openFixedDropdown(participateDeptToggle, participateDeptDropdown);
                const checkbox = document.querySelector(`#eventParticipateDeptDropdown input[value="${value}"]`);
                if (checkbox) checkbox.scrollIntoView({ block: 'center', behavior: 'smooth' });
            };
            
            // 添加删除按钮
            const removeBtn = document.createElement('span');
            removeBtn.className = 'remove-dept-btn';
            removeBtn.textContent = '×';
            removeBtn.onclick = (e) => {
                e.stopPropagation();
                // 从已选列表中移除
                const index = selectedValues.indexOf(value);
                if (index > -1) {
                    selectedValues.splice(index, 1);
                    // 更新多选下拉框中的选中状态
                    const checkbox = document.querySelector(`#eventParticipateDeptDropdown input[value="${value}"]`);
                    if (checkbox) {
                        checkbox.checked = false;
                    }
                    // 更新摘要
                    updateMultiSelectSummary(participateDeptToggle, selectedValues.length, '请选择参与部门');
                    // 重新渲染已选部门
                    updateSelectedDepartments(deptOptions, selectedValues);
                }
            };
            
            tag.appendChild(removeBtn);
            container.appendChild(tag);
        });
    }

    // 新增：更新已选参会人员显示
    function updateSelectedParticipants(personOptions, selectedIds) {
        const container = document.getElementById('selectedParticipants');
        if (!container) return;

        container.innerHTML = '';
        if (!selectedIds || selectedIds.length === 0) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'flex';
        selectedIds.forEach(id => {
            const name = personOptions.find(p => p.id === id)?.name || id;
            const tag = document.createElement('span');
            tag.className = 'selected-participant-tag';
            tag.textContent = name;

            // 点击标签展开下拉并滚动到对应项
            tag.onclick = () => {
                openFixedDropdown(participantsToggle, participantsDropdown);
                const checkbox = document.querySelector(`#eventParticipantsDropdown input[value="${id}"]`);
                if (checkbox) checkbox.scrollIntoView({ block: 'center', behavior: 'smooth' });
            };

            const removeBtn = document.createElement('span');
            removeBtn.className = 'remove-participant-btn';
            removeBtn.textContent = '×';
            removeBtn.onclick = (e) => {
                e.stopPropagation();
                const idx = selectedIds.indexOf(id);
                if (idx > -1) {
                    selectedIds.splice(idx, 1);
                    const checkbox = document.querySelector(`#eventParticipantsDropdown input[value="${id}"]`);
                    if (checkbox) checkbox.checked = false;
                    updateMultiSelectSummary(participantsToggle, selectedIds.length, '请选择参会人员');
                    updateSelectedParticipants(personOptions, selectedIds);
                }
            };

            tag.appendChild(removeBtn);
            container.appendChild(tag);
        });
    }

    // 确保 toggle 在模态可视区域内（避免被模态容器底部裁剪，导致控件本身不可见）
    function ensureToggleVisible(toggleBtn) {
        if (!toggleBtn || !toggleBtn.closest) return;
        const modalContent = toggleBtn.closest('.modal-content');
        if (!modalContent) return;

        // 尝试使用 scrollIntoView 作为第一步（大多数浏览器会处理好）
        try {
            toggleBtn.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'nearest' });
        } catch (e) {
            // ignore
        }

        // 使用 getBoundingClientRect 计算元素在 modalContent 中的精确位置，保证 placeholder 完整可见
        const padding = 18; // 额外留白，避免接近边缘被视觉裁剪
        const elRect = toggleBtn.getBoundingClientRect();
        const modalRect = modalContent.getBoundingClientRect();

        // 计算元素在 modalContent 内的相对滚动坐标
        const elTopInModal = (elRect.top - modalRect.top) + modalContent.scrollTop;
        const elBottomInModal = elTopInModal + elRect.height;

        const viewTop = modalContent.scrollTop;
        const viewBottom = viewTop + modalContent.clientHeight;

        let desired = viewTop;
        if (elTopInModal < viewTop + padding) {
            desired = Math.max(0, elTopInModal - padding);
        } else if (elBottomInModal > viewBottom - padding) {
            desired = Math.min(modalContent.scrollHeight - modalContent.clientHeight, elBottomInModal - modalContent.clientHeight + padding);
        } else {
            // 已在可见区域
            return;
        }

        // 写入多次并用双 rAF + 短时 setTimeout 做保险，确保浏览器完成重排与重绘
        modalContent.scrollTop = desired;
        window.requestAnimationFrame(() => {
            modalContent.scrollTop = desired;
            window.requestAnimationFrame(() => {
                modalContent.scrollTop = desired;
                setTimeout(() => {
                    if (modalContent.scrollTop !== desired) modalContent.scrollTop = desired;
                }, 40);
            });
        });
    }

    // 处理多选下拉展开/收起（fixed 定位以避免被 modal 或页面滚动裁剪）
    function openFixedDropdown(toggleBtn, dropdown) {
        // 先关闭其他下拉
        closeAllMultiSelectDropdowns();

        const rect = toggleBtn.getBoundingClientRect();

        // 若尚未移动到 body，则暂时移动到 body，避免受 modal 或父容器 overflow 裁剪
        if (!dropdown._movedToBody) {
            dropdown._originalParent = dropdown.parentNode;
            dropdown._nextSibling = dropdown.nextSibling;
            document.body.appendChild(dropdown);
            dropdown._movedToBody = true;
        }

        dropdown.classList.add('fixed');
        dropdown.style.position = 'fixed';
        dropdown.style.left = rect.left + 'px';
        dropdown.style.width = rect.width + 'px';

        // 计算可用空间
        const availableBelow = window.innerHeight - rect.bottom - 20;
        const availableAbove = rect.top - 20;

        // 预设最大高度上限
        const maxLimit = 520;
        const minLimit = 120;

        const headerEl = dropdown.querySelector('.multi-select-header');
        const headerH = headerEl ? headerEl.offsetHeight : 40;
        const optionsContainer = dropdown.querySelector('.multi-select-options');

        // 预估理想高度：header + options 的实际高度（受限于 maxLimit）
        // 若 optionsContainer.scrollHeight 为 0（尚未渲染到可见），用子项数目估算高度，避免出现太小导致位置异常
        let optionsContentHeight = 200;
        if (optionsContainer) {
            const scrollH = optionsContainer.scrollHeight || (optionsContainer.children.length * 30);
            optionsContentHeight = Math.max(80, scrollH);
        }
        const desiredHeight = Math.min(maxLimit, headerH + Math.max(80, Math.min(optionsContentHeight, maxLimit - headerH)));

        // 如果没有任何选项，显示占位文案
        if (optionsContainer && optionsContainer.children.length === 0) {
            optionsContainer.innerHTML = '<div class="multi-select-empty">无匹配项</div>';
        }
        // 决定显示在上方还是下方
        // 如果是参会人员（位于模态底部）则**始终**在上方显示，防止被截断
        let showAbove = false;
        if (toggleBtn && (toggleBtn.id === 'eventParticipantsToggle')) {
            showAbove = true;
        } else if (availableBelow < desiredHeight && availableAbove > availableBelow) {
            showAbove = true;
        }

        if (showAbove) {
            const topPos = Math.max(10, rect.top - desiredHeight - 6);
            dropdown.style.top = topPos + 'px';
            dropdown.classList.add('above');
            dropdown.style.maxHeight = Math.min(desiredHeight, availableAbove) + 'px';
        } else {
            dropdown.style.top = (rect.bottom + 6) + 'px';
            dropdown.classList.remove('above');
            dropdown.style.maxHeight = Math.min(desiredHeight, availableBelow) + 'px';
        }

        // 限制 options 容器高度为 header 之外的剩余空间
        if (optionsContainer) {
            const currentMax = parseInt(dropdown.style.maxHeight, 10) || Math.min(desiredHeight, maxLimit);
            optionsContainer.style.maxHeight = Math.max(60, currentMax - headerH - 10) + 'px';
        }

        dropdown.style.display = 'block';
        toggleBtn.classList.add('open');

        // 绑定自动重新定位（包含上下翻转判断）
        const reposition = () => {
            const r = toggleBtn.getBoundingClientRect();
            dropdown.style.left = r.left + 'px';
            dropdown.style.width = r.width + 'px';

            const availB = window.innerHeight - r.bottom - 20;
            const availA = r.top - 20;
            let showAboveNow = false;
            // 参会人员下拉始终在上方显示（防止位于模态底部时被遮挡）
            if (toggleBtn && toggleBtn.id === 'eventParticipantsToggle') {
                showAboveNow = true;
            } else if (availB < 140 && availA > availB) showAboveNow = true;

            if (showAboveNow) {
                const topPos = Math.max(10, r.top - parseInt(dropdown.style.maxHeight || desiredHeight, 10) - 6);
                dropdown.style.top = topPos + 'px';
                dropdown.classList.add('above');
            } else {
                dropdown.style.top = (r.bottom + 6) + 'px';
                dropdown.classList.remove('above');
            }

            const mh = showAboveNow ? Math.min(maxLimit, Math.max(minLimit, availA)) : Math.min(maxLimit, Math.max(minLimit, availB));
            dropdown.style.maxHeight = mh + 'px';
            if (optionsContainer) {
                const hdr = headerEl ? headerEl.offsetHeight : 40;
                optionsContainer.style.maxHeight = Math.max(60, mh - hdr - 10) + 'px';
            }
        };
        dropdown._reposition = reposition;
        window.addEventListener('scroll', reposition, true);
        window.addEventListener('resize', reposition);
    }

    function closeFixedDropdown(toggleBtn, dropdown) {
        if (!dropdown) return;
        dropdown.style.display = 'none';
        dropdown.classList.remove('fixed');
        dropdown.style.position = '';
        dropdown.style.top = '';
        dropdown.style.left = '';
        dropdown.style.width = '';
        toggleBtn && toggleBtn.classList.remove('open');
        if (dropdown._reposition) {
            window.removeEventListener('scroll', dropdown._reposition, true);
            window.removeEventListener('resize', dropdown._reposition);
            delete dropdown._reposition;
        }

        // 如果之前为了避免被 modal 裁剪而移动到了 body，现在恢复回原位
        if (dropdown._movedToBody && dropdown._originalParent) {
            try {
                if (dropdown._nextSibling) {
                    dropdown._originalParent.insertBefore(dropdown, dropdown._nextSibling);
                } else {
                    dropdown._originalParent.appendChild(dropdown);
                }
            } catch (e) {
                // 忽略恢复失败
            }
            delete dropdown._movedToBody;
            delete dropdown._originalParent;
            delete dropdown._nextSibling;
        }
    }

    if (participantsToggle && participantsDropdown) {
        participantsToggle.addEventListener('click', () => {
            const isShown = participantsDropdown.style.display === 'block';
            if (isShown) {
                closeFixedDropdown(participantsToggle, participantsDropdown);
            } else {
                // 先确保 toggle 在模态可视区域，避免控件本身被遮挡
                ensureToggleVisible(participantsToggle);
                // 等待下一帧，确保滚动完成并触发重排后再打开下拉
                window.requestAnimationFrame(() => openFixedDropdown(participantsToggle, participantsDropdown));
            }
        });
    }
    if (participateDeptToggle && participateDeptDropdown) {
        participateDeptToggle.addEventListener('click', () => {
            const isShown = participateDeptDropdown.style.display === 'block';
            if (isShown) {
                closeFixedDropdown(participateDeptToggle, participateDeptDropdown);
            } else {
                // 确保 toggle 可见后再打开
                ensureToggleVisible(participateDeptToggle);
                window.requestAnimationFrame(() => openFixedDropdown(participateDeptToggle, participateDeptDropdown));
            }
        });
    }

    // 点击页面任意处关闭展开的下拉（若点击在下拉或 toggle 内则不关闭）
    document.addEventListener('click', function(e) {
        if (e.target.closest && (e.target.closest('.multi-select') || e.target.closest('.multi-select-dropdown'))) {
            return;
        }
        closeAllMultiSelectDropdowns();
    });

    // 点击模态框空白处时，顺带收起多选下拉
    function closeAllMultiSelectDropdowns() {
        closeFixedDropdown(participantsToggle, participantsDropdown);
        closeFixedDropdown(participateDeptToggle, participateDeptDropdown);
    }
    
    /**
     * 格式化日期时间
     */
    function formatDateTime(dateStr) {
        if (!dateStr) return '未知';
        
        const date = new Date(dateStr);
        return date.toLocaleString('zh-CN');
    }
});