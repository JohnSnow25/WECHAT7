const Fs = require('fs');
const Request = require('request-promise');

const Base = 'https://api.weixin.qq.com/cgi-bin/';
const MpBase = 'https://mp.weixin.qq.com/cgi-bin/';
const SemanticUrl = 'https://api.weixin.qq.com/semantic/semproxy/search?';
const Api = {
    accessToken: Base + 'token?grant_type=client_credential',
    temporary: {
        upload: Base + 'media/upload?',
        fetch: Base + 'media/get?'
    },
    permanent: {
        upload: Base + 'material/add_material?',
        uploadNews: Base + 'material/add_news?',
        uploadNewsPic: Base + 'media/uploadimg?',
        fetch: Base + 'material/get_material?',
        del: Base + 'material/del_material?',
        update: Base + 'material/update_news?',
        count: Base + 'material/get_materialcount?',
        batch: Base + 'material/batchget_material?'
    },
    tag: {
        create: Base + 'tags/create?',
        fetch: Base + 'tags/get?',
        update: Base + 'tags/update?',
        del: Base + 'tags/delete?',
        fetchUsers: Base + 'user/tag/get?',
        batchTag: Base + 'tags/members/batchtagging?',
        batchUnTag: Base + 'tags/members/batchuntagging?',
        getUserTags: Base + 'tags/getidlist?'
    },
    user: {
        fetch: Base + 'user/get?',
        remark: Base + 'user/info/updateremark?',
        info: Base + 'user/info?',
        batch: Base + 'user/info/batchget?'
    },
    qrcode: {
        create: Base + 'qrcode/create?',
        show: MpBase + 'showqrcode?'
    },
    shortUrl: {
        create: Base + 'shorturl?'
    },
    SemanticUrl,
    ai: {
        translate: Base + 'media/voice/translatecontent?'
    },
    menu: {
        create: Base + 'menu/create?',
        del: Base + 'menu/delete?',
        custom: Base + 'menu/addconditional?',
        fetch: Base + 'menu/get?'
    },
    ticket: {
        get: Base + 'ticket/getticket?'
    }
};

module.exports = class WeChat {
    constructor(opts) {
        this.opts = Object.assign({}, opts);
        this.appID = opts.appID;
        this.appSecret = opts.appSecret;
        this.getAccessToken = opts.getAccessToken;
        this.saveAccessToken = opts.saveAccessToken;
        this.getTicket = opts.getTicket;
        this.saveTicket = opts.saveTicket;

        this.fetchAccessToken();
    }
    async request(opts) {
        opts = Object.assign({}, opts, { json: true });
        try {
            const res = await Request(opts);
            return res;
        } catch (err) {
            console.log(err);
        }
    }
    async fetchAccessToken() {
        let data = await this.getAccessToken();
        if (!this.isValid(data)) {
            data = await this.updateAccessToken();
        }
        return data;
    }
    async updateAccessToken() {
        const url = `${Api.accessToken}&appid=${this.appID}&secret=${
            this.appSecret
        }`;
        const data = await this.request({ url });

        const Now = new Date().getTime();
        const ExpiresIn = Now + (data.expires_in - 20) * 1000;

        data.expires_in = ExpiresIn;

        await this.saveAccessToken(data);

        return data;
    }
    async fetchTicket(token) {
        let data = await this.getTicket();
        if (!this.isValid(data)) {
            data = await this.updateTicket(token);
        }
        return data;
    }
    async updateTicket(token) {
        const url = `${Api.ticket.get}access_token=${token}&type=jsapi`;
        const data = await this.request({ url });

        const Now = new Date().getTime();
        const ExpiresIn = Now + (data.expires_in - 20) * 1000;

        data.expires_in = ExpiresIn;

        await this.saveTicket(data);

        return data;
    }
    isValid(data) {
        if (!data || !data.expires_in) {
            return false;
        }
        const ExpiresIn = data.expires_in;
        const Now = new Date().getTime();
        if (Now < ExpiresIn) {
            return true;
        } else {
            return false;
        }
    }
    uploadMaterial(token, type, material, permanent = false) {
        let form = {};
        let url = Api.temporary.upload;

        if (permanent) {
            url = Api.permanent.upload;
            form = Object.assign(form, permanent);
        }

        if (type === 'pic') {
            url = Api.permanent.uploadNewsPic;
        }

        if (type === 'news') {
            url = Api.permanent.uploadNews;
            form = material;
        } else {
            form.media = Fs.createReadStream(material);
        }

        let uploadUrl = `${url}access_token=${token}`;

        if (!permanent) {
            uploadUrl += `&type=${type}`;
        } else {
            if (type !== 'news') {
                form.access_token = token;
            }
        }
        const options = {
            method: 'POST',
            url: uploadUrl,
            json: true
        };

        if (type === 'news') {
            options.body = form;
        } else {
            options.formData = form;
        }

        return options;
    }
    fetchMaterial(token, mediaId, type, permanent) {
        let form = {};
        let fetchUrl = Api.temporary.fetch;
        if (permanent) {
            fetchUrl = Api.permanent.fetch;
        }
        let url = `${fetchUrl}access_token=${token}`;
        const Options = {
            method: 'POST',
            url
        };
        if (permanent) {
            form.media_id = mediaId;
            form.access_token = token;
            Options.body = form;
        } else {
            if ('video' === type) {
                url = url.replace('https:', 'http');
            }
            url += '&media_id=' + mediaId;
        }
        return Options;
    }
    deleteMaterial(token, mediaId) {
        const Form = {
            media_id: mediaId
        };
        let url = `${
            Api.permanent.del
        }access_token=${token}&media_id=${mediaId}`;
        return {
            method: 'POST',
            url,
            body: Form
        };
    }
    updateMaterial(token, mediaId, news) {
        let form = {
            media_id: mediaId
        };
        form = Object.assign(form, news);
        let url = `${
            Api.permanent.update
        }access_token=${token}&media_id=${mediaId}`;
        return {
            method: 'POST',
            url,
            body: form
        };
    }
    countMaterial(token) {
        let url = `${Api.permanent.count}access_token=${token}`;
        return {
            url
        };
    }
    batchMaterial(token, options) {
        options.type = options.type || 'image';
        options.offset = options.offset || 0;
        options.count = options.count || 10;

        let url = `${Api.permanent.batch}access_token=${token}`;

        return {
            method: 'POST',
            url,
            body: options
        };
    }
    createTag(token, name) {
        let body = {
            tag: {
                name
            }
        };
        let url = `${Api.tag.create}access_token=${token}`;
        return {
            method: 'POST',
            url,
            body
        };
    }
    fetchTags(token) {
        let url = `${Api.tag.fetch}access_token=${token}`;
        return {
            url
        };
    }
    updateTag(token, id, name) {
        let body = {
            tag: {
                id,
                name
            }
        };
        let url = `${Api.tag.update}access_token=${token}`;
        return {
            method: 'POST',
            url,
            body
        };
    }
    delTag(token, id) {
        let body = {
            tag: {
                id
            }
        };
        let url = `${Api.tag.del}access_token=${token}`;
        return {
            method: 'POST',
            url,
            body
        };
    }
    fetchTagUsers(token, tagId, openId) {
        let body = {
            tagid: tagId,
            next_openid: openId || ''
        };
        let url = `${Api.tag.fetchUsers}access_token=${token}`;
        return {
            method: 'POST',
            url,
            body
        };
    }
    batchUsersTag(token, openIdList, tagId, unTag) {
        let body = {
            openid_list: openIdList,
            tagid: tagId
        };
        let url = `${
            !unTag ? Api.tag.batchTag : Api.tag.batchUnTag
        }access_token=${token}`;
        return {
            method: 'POST',
            url,
            body
        };
    }
    getUserTags(token, openId) {
        let body = {
            openid: openId
        };
        let url = `${Api.tag.getUserTags}access_token=${token}`;
        return {
            method: 'POST',
            url,
            body
        };
    }
    getUsers(token, openId) {
        let url = `${
            Api.user.fetch
        }access_token=${token}&next_openid=${openId || ''}`;
        return {
            url
        };
    }
    remarkUser(token, openId, remark) {
        let body = {
            openid: openId,
            remark: remark
        };
        let url = `${Api.user.remark}access_token=${token}`;
        return {
            method: 'POST',
            url,
            body
        };
    }
    getUserInfo(token, openId, lang = 'zh_CN') {
        let url = `${
            Api.user.info
        }access_token=${token}&openid=${openId}&lang=${lang}`;
        return {
            url
        };
    }
    batchUserInfo(token, user_list) {
        let body = {
            user_list
        };
        let url = `${Api.user.batch}access_token=${token}`;
        return {
            method: 'POST',
            url,
            body
        };
    }
    createQrcode(token, qr) {
        let url = `${Api.qrcode.create}access_token=${token}`;
        let body = qr;
        return {
            method: 'POST',
            url,
            body
        };
    }
    showQrcode(ticket) {
        let url = `${Api.qrcode.show}ticket=${encodeURI(ticket)}`;
        return url;
    }
    createShortUrl(token, longUrl, action = 'long2short') {
        let body = {
            action,
            long_url: longUrl
        };
        let url = `${Api.shortUrl.create}access_token=${token}`;
        return {
            method: 'POST',
            url,
            body
        };
    }
    semantic(token, semanticData) {
        let url = `${Api.SemanticUrl}access_token=${token}`;
        semanticData.appid = this.appID;
        return {
            method: 'POST',
            url,
            body: semanticData
        };
    }
    aiTranslate(token, body, lfrom, lto) {
        let url = `${
            Api.ai.translate
        }access_token=${token}&lfrom=${lfrom}&lto=${lto}`;
        return {
            method: 'POST',
            url,
            body
        };
    }
    createMenu(token, menu, rules) {
        let url = `${Api.menu.create}access_token=${token}`;
        if (rules) {
            url = `${Api.menu.custom}access_token=${token}`;
            menu.matchrule = rules;
        }
        return {
            method: 'POST',
            url,
            body: menu
        };
    }
    deleteMenu(token) {
        let url = `${Api.menu.del}access_token=${token}`;
        return {
            url
        };
    }
    fetchMenu(token) {
        let url = `${Api.menu.fetch}access_token=${token}`;
        return {
            url
        };
    }
    async handle(operation, ...args) {
        console.log(`handle -> ${operation} -> ${args}`);
        const TokenData = await this.fetchAccessToken();
        const Options = this[operation](TokenData.access_token, ...args);
        const Data = await this.request(Options);
        console.log(operation, ':', Data);
        return Data;
    }
};
