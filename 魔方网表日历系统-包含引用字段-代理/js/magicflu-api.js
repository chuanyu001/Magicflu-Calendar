/**
 * 魔方网表API封装 - 通过代理服务器访问
 */
class MagicFluApi {
    constructor() {
        // 代理服务器地址
        this.proxyBaseUrl = 'http://localhost:3000';
        this.token = null;
        this.tokenExpiry = null;
        this.userInfo = null;
        this.currentServerType = 'internal'; // 'internal' 或 'external'
        
        // 应用ID和表单ID保持不变
        this.workTaskForm = {
            appId: 'a8474b7f-4347-4c30-86d2-f07f288a9f45',
            formId: 'f6506169-2cbf-4194-81eb-4011e61c864a'
        };
        
        this.personnelForm = {
            appId: 'a8474b7f-4347-4c30-86d2-f07f288a9f45',
            formId: 'd5399424-dcad-4b29-b6be-5c6652f410cd'
        };
        
        // 负责人颜色映射
        this.responsibleColors = {};
        this.personnelMap = {};
        this.nextColorIndex = 0;
        this.departmentSet = new Set();
        
        // 预定义颜色列表
        this.colorPalette = [
            '#1abc9c', '#2ecc71', '#3498db', '#9b59b6', '#34495e',
            '#16a085', '#27ae60', '#2980b9', '#8e44ad', '#2c3e50',
            '#f1c40f', '#e67e22', '#e74c3c', '#ecf0f1', '#95a5a6',
            '#f39c12', '#d35400', '#c0392b', '#bdc3c7', '#7f8c8d'
        ];
    }
    
    /**
     * 设置服务器类型
     */
    setServerType(serverType) {
        this.currentServerType = serverType;
    }
    
    /**
     * 通过代理服务器登录
     */
    async login(username, password) {
        try {
            const url = `${this.proxyBaseUrl}/api/proxy/login`;
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username,
                    password,
                    serverType: this.currentServerType
                })
            });
            
            if (!response.ok) {
                throw new Error(`登录失败: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.token = data.token;
                this.tokenExpiry = Date.now() + 30 * 60 * 1000;
                this.userInfo = data.userInfo;
                
                // 保存到localStorage
                localStorage.setItem('mf_token', this.token);
                localStorage.setItem('mf_token_expiry', this.tokenExpiry);
                localStorage.setItem('mf_user_info', JSON.stringify(this.userInfo));
                localStorage.setItem('mf_server_type', this.currentServerType);
                
                return { success: true, userInfo: this.userInfo };
            } else {
                return { success: false, message: data.message || '登录失败' };
            }
        } catch (error) {
            console.error('登录错误:', error);
            return { success: false, message: `登录失败: ${error.message}` };
        }
    }
    
    /**
     * 从localStorage恢复登录状态
     */
    restoreLogin() {
        const token = localStorage.getItem('mf_token');
        const expiry = localStorage.getItem('mf_token_expiry');
        const userInfo = localStorage.getItem('mf_user_info');
        const serverType = localStorage.getItem('mf_server_type');
        
        if (token && expiry && userInfo && serverType) {
            const now = Date.now();
            if (now < parseInt(expiry)) {
                this.token = token;
                this.tokenExpiry = parseInt(expiry);
                this.userInfo = JSON.parse(userInfo);
                this.currentServerType = serverType;
                return { success: true, userInfo: this.userInfo };
            } else {
                this.clearStoredAuth();
                return { success: false, message: '登录已过期，请重新登录' };
            }
        }
        
        return { success: false, message: '请先登录' };
    }
    
    /**
     * 清除存储的认证信息
     */
    clearStoredAuth() {
        localStorage.removeItem('mf_token');
        localStorage.removeItem('mf_token_expiry');
        localStorage.removeItem('mf_user_info');
        localStorage.removeItem('mf_server_type');
        this.token = null;
        this.tokenExpiry = null;
        this.userInfo = null;
    }
    
    /**
     * 获取请求头
     */
    getHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        
        return headers;
    }
    
    /**
     * 检查token是否有效
     */
    async checkToken() {
        if (!this.token || !this.tokenExpiry) {
            return false;
        }
        
        const now = Date.now();
        const timeLeft = this.tokenExpiry - now;
        
        // 如果token还剩不到5分钟，需要重新登录
        if (timeLeft < 5 * 60 * 1000) {
            return false;
        }
        
        return true;
    }
    
    /**
     * 构建代理URL
     */
    buildProxyUrl(path) {
        return `${this.proxyBaseUrl}/api/proxy/${this.currentServerType}${path}`;
    }
    
    /**
     * 获取工作任务记录
     */
    async getWorkTasks(start = 0, limit = -1, bq = '') {
        try {
            const isValidToken = await this.checkToken();
            if (!isValidToken) {
                return { success: false, message: 'Token无效或已过期，请重新登录' };
            }
            
            let url = this.buildProxyUrl(`/magicflu/service/s/jsonv2/${this.workTaskForm.appId}/forms/${this.workTaskForm.formId}/records/entry`);
            const params = new URLSearchParams({
                start: start.toString(),
                limit: limit.toString()
            });
            
            if (bq) {
                params.append('bq', bq);
            }
            
            url += `?${params.toString()}`;
            
            const response = await fetch(url, {
                method: 'GET',
                headers: this.getHeaders()
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    this.clearStoredAuth();
                    throw new Error('Token无效或已过期，请重新登录');
                }
                throw new Error(`获取数据失败: ${response.status}`);
            }
            
            const data = await response.json();
            return { success: true, data: data.entry || [], totalCount: data.totalCount || 0 };
        } catch (error) {
            console.error('获取工作任务记录错误:', error);
            return { success: false, message: error.message };
        }
    }
    
    /**
     * 添加工作任务记录
     */
    async addWorkTask(taskData) {
        try {
            const isValidToken = await this.checkToken();
            if (!isValidToken) {
                return { success: false, message: 'Token无效或已过期，请重新登录' };
            }
            
            const url = this.buildProxyUrl(`/magicflu/service/s/jsonv2/${this.workTaskForm.appId}/forms/${this.workTaskForm.formId}/records`);
            
            const response = await fetch(url, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(taskData)
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    this.clearStoredAuth();
                    throw new Error('Token无效或已过期，请重新登录');
                }
                throw new Error(`添加记录失败: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.errcode === '0') {
                return { success: true, id: data.id, message: '添加成功' };
            } else {
                return { success: false, message: data.errmsg || '添加失败' };
            }
        } catch (error) {
            console.error('添加工作任务记录错误:', error);
            return { success: false, message: error.message };
        }
    }
    
    /**
     * 获取人员信息
     */
    async getPersonnel(start = 0, limit = -1, bq = '') {
        try {
            const isValidToken = await this.checkToken();
            if (!isValidToken) {
                return { success: false, message: 'Token无效或已过期，请重新登录' };
            }
            
            let url = this.buildProxyUrl(`/magicflu/service/s/jsonv2/${this.personnelForm.appId}/forms/${this.personnelForm.formId}/records/entry`);
            const params = new URLSearchParams({
                start: start.toString(),
                limit: limit.toString()
            });
            
            if (bq) {
                params.append('bq', bq);
            }
            
            url += `?${params.toString()}`;
            
            const response = await fetch(url, {
                method: 'GET',
                headers: this.getHeaders()
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    this.clearStoredAuth();
                    throw new Error('Token无效或已过期，请重新登录');
                }
                throw new Error(`获取人员信息失败: ${response.status}`);
            }
            
            const data = await response.json();
            
            // 构建人员映射及部门集合
            this.personnelMap = {};
            this.personLabelToId = {};
            this.departmentSet = new Set();
            if (data.entry) {
                data.entry.forEach(person => {
                    this.personnelMap[person.id] = person;
                    if (person.renyuan) {
                        this.personLabelToId[person.renyuan] = person.id;
                    }
                    if (person.bumen) {
                        this.departmentSet.add(person.bumen);
                    }
                });
            }
            
            return { success: true, data: data.entry || [], totalCount: data.totalCount || 0 };
        } catch (error) {
            console.error('获取人员信息错误:', error);
            return { success: false, message: error.message };
        }
    }
    
    getColorForResponsible(responsibleId) {
        if (!responsibleId) {
            return '#7f8c8d';
        }
        
        if (!this.responsibleColors[responsibleId]) {
            const color = this.colorPalette[this.nextColorIndex % this.colorPalette.length];
            const person = this.personnelMap[responsibleId];
            const name = person && person.renyuan ? person.renyuan : responsibleId;
            
            this.responsibleColors[responsibleId] = {
                color,
                name
            };
            
            this.nextColorIndex++;
        }
        
        return this.responsibleColors[responsibleId].color;
    }
    
    getPersonnelInfo(responsibleId) {
        if (!responsibleId) return null;
        return this.personnelMap[responsibleId] || null;
    }
    
    buildResponsibleOptions() {
        const options = [];
        for (const id in this.personnelMap) {
            const person = this.personnelMap[id];
            options.push({
                id,
                name: person.renyuan || id
            });
        }
        
        options.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
        
        return options;
    }

    buildDepartmentOptions() {
        const options = [];
        if (this.departmentSet) {
            this.departmentSet.forEach(name => {
                options.push({
                    id: name,
                    name
                });
            });
        }
        options.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
        return options;
    }
    
    buildTaskQuery(filters = {}) {
        const conditions = [];
        
        // 负责人：引用字段，接口要求字符串 + Base64
        if (filters.responsibleId) {
            const person = this.personnelMap[filters.responsibleId];
            if (person && person.renyuan) {
                const encoded = this.base64Encode(person.renyuan);
                if (encoded) {
                    conditions.push(`fuzeren(eq):_${encoded}`);
                }
            }
        }
        
        // 优先级：下拉列表，按选项 ID 精确查询
        if (filters.priority) {
            const encoded = this.base64Encode(String(filters.priority));
            if (encoded) {
                conditions.push(`youxianji(eq):_${encoded}`);
            }
        }
        
        // 当前状态：下拉列表，按选项 ID 精确查询
        if (filters.status) {
            const encoded = this.base64Encode(String(filters.status));
            if (encoded) {
                conditions.push(`dangqianzhuangtai(eq):_${encoded}`);
            }
        }
        
        if (conditions.length === 0) {
            return '';
        }
        
        const raw = conditions.join('&&');
        return encodeURIComponent(raw);
    }
    
    convertToCalendarEvents(workTasks) {
        if (!Array.isArray(workTasks)) return [];
        
        const events = [];
        
        workTasks.forEach(task => {
            const start = task.kaishishijian || task.created;
            const end = task.jieshushijian || task.kaishishijian || task.created;
            
            if (!start) {
                return;
            }
            
            const responsibleName = task.fuzeren || '';
            const responsibleId = this.extractResponsibleId(responsibleName);
            
            const colorKey = responsibleId || responsibleName;
            const bgColor = this.getColorForResponsible(colorKey);
            
            events.push({
                id: task.id,
                title: task.renwumingcheng || '未命名任务',
                start: start.replace(' ', 'T'),
                end: end ? end.replace(' ', 'T') : undefined,
                allDay: false,
                backgroundColor: bgColor,
                borderColor: bgColor,
                // 将创建时间放到根级属性，便于 FullCalendar 的 eventOrder 使用
                createdTime: task.created || '',
                extendedProps: {
                    // 业务字段
                    taskNumber: task.renwubianhao,
                    sourceTaskCode: task.yuanrenwubianma || '',
                    content: task.renwuneirong,
                    responsible: responsibleName || '未指定',
                    responsibleId,
                    department: task.zerenbumen || '',
                    participateDepartments: task.canyubumen1 || '',
                    supervisor: task.shangji || '',
                    host: task.zhuchiren || '',
                    participants: task.canhuirenyuan || '',
                    recorder: task.jiluren || '',
                    // 状态字段
                    priority: task.youxianji,
                    status: task.dangqianzhuangtai,
                    priorityText: this.getPriorityText(task.youxianji),
                    statusText: this.getStatusText(task.dangqianzhuangtai),
                    // 系统字段
                    recordId: task.id || '',
                    recordNo: task.no || '',
                    creator: task.creatorname || '',
                    creatorNum: task.creatornum || '',
                    createdTime: task.created || '',
                    updater: task.updatorname || '',
                    updaterNum: task.updatornum || '',
                    updatedTime: task.updated || ''
                }
            });
        });
        
        return events;
    }
    
    extractResponsibleId(responsibleField) {
        if (!responsibleField || !this.personLabelToId) return null;
        return this.personLabelToId[responsibleField] || null;
    }
    
    getPriorityText(priorityId) {
        const id = Number(priorityId);
        if (!id) return '未设置';
        switch (id) {
            case 1: return '高';
            case 2: return '中';
            case 3: return '低';
            default: return '未设置';
        }
    }
    
    getStatusText(statusId) {
        const id = Number(statusId);
        if (!id) return '未设置';
        switch (id) {
            case 1: return '待开始';
            case 2: return '执行中';
            case 3: return '已完成';
            default: return '未设置';
        }
    }
    
    buildTaskData(formData) {
        const formatDateTime = (str) => {
            if (!str) return '';
            if (str.length === 16) {
                return str + ':00';
            }
            return str;
        };
        
        const data = {
            renwumingcheng: formData.title,
            renwuneirong: formData.content,
            kaishishijian: formatDateTime(formData.startTime),
            jieshushijian: formatDateTime(formData.endTime)
        };
        
        if (formData.responsibleId) {
            data.fuzeren = {
                id: String(formData.responsibleId)
            };
        }

        // 责任部门
        if (formData.department) {
            data.zerenbumen = formData.department;
        }

        // 参与部门：前端是数组（多选），这里拼成逗号分隔字符串提交
        if (formData.participateDept && Array.isArray(formData.participateDept)) {
            if (formData.participateDept.length > 0) {
                data.canyubumen1 = formData.participateDept.join(',');
            }
        } else if (typeof formData.participateDept === 'string' && formData.participateDept.trim()) {
            data.canyubumen1 = formData.participateDept.trim();
        }        
                
        // 主持人：从人员信息表根据 hostId 取姓名
        if (formData.hostId) {
            const hostPerson = this.personnelMap[formData.hostId];
            if (hostPerson && hostPerson.renyuan) {
                data.zhuchiren = hostPerson.renyuan;
            }
        }

        // 参会人员：根据多个人员ID拼接姓名，逗号分隔
        if (Array.isArray(formData.participantIds) && formData.participantIds.length > 0) {
            const names = formData.participantIds
                .map(id => {
                    const p = this.personnelMap[id];
                    return p && p.renyuan ? p.renyuan : '';
                })
                .filter(Boolean);
            if (names.length > 0) {
                data.canhuirenyuan = names.join(',');
            }
        }

        // 记录人：从人员信息表根据 recorderId 取姓名
        if (formData.recorderId) {
            const recorderPerson = this.personnelMap[formData.recorderId];
            if (recorderPerson && recorderPerson.renyuan) {
                data.jiluren = recorderPerson.renyuan;
            }
        }
        
        if (formData.priority) {
            data.youxianji = Number(formData.priority);
        }
        
        if (formData.status) {
            data.dangqianzhuangtai = Number(formData.status);
        }
        
        return data;
    }
    
    getResponsibleColorMap() {
        return this.responsibleColors;
    }
    
    /**
     * Base64 编码（支持中文）
     */
    base64Encode(str) {
        try {
            return btoa(unescape(encodeURIComponent(str)));
        } catch (e) {
            console.error('Base64编码失败:', e);
            return '';
        }
    }
}

// 创建全局实例
const magicFluApi = new MagicFluApi();