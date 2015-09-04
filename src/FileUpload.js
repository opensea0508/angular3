/**
 * Created by cheesu on 2015/8/17.
 */

/**
 * React文件上传组件，兼容IE8+
 * 现代浏览器采用AJAX（XHR2+File API）上传。低版本浏览器使用form+iframe上传。
 * 使用到ES6，需要经babel转译
 */


//let React = require('react');
const emptyFunction = function () {
};
/*当前IE上传组的id*/
let currentIEID = 0;

let FileUpload = React.createClass({

    getInitialState(){
        return {
            chooseBtn: {},       //选择按钮。如果chooseAndUpload=true代表选择并上传。
            uploadBtn: {},       //上传按钮。如果chooseAndUpload=true则无效。
            before: [],      //存放props.children中位于chooseBtn前的元素
            middle: [],      //存放props.children中位于chooseBtn后，uploadBtn前的元素
            after: []        //存放props.children中位于uploadBtn后的元素
        }

    },

    propTypes: {
        options: React.PropTypes.object,
        style: React.PropTypes.object,
        className: React.PropTypes.string
    },

    componentWillMount(){
        this.isIE = this.checkIE() > 0;
        this.updateProps(this.props);
    },

    componentWillReceiveProps(newProps){
        this.updateProps(newProps);
    },

    render(){
        return this.packRender();
    },

    /*根据props更新组件*/
    updateProps(props){
        this.isIE = this.checkIE() > 0;
        let options = props.options;
        this.baseUrl = options.baseUrl;     //域名
        this.param = options.param;     //get参数
        this.chooseAndUpload = options.chooseAndUpload || false;      //是否在用户选择了文件之后立刻上传
        this.paramAddToFile = options.paramAddToFile || [];     //需要添加到file对象（file API）上的param，不支持IE
        /*upload success 返回resp的格式*/
        this.dataType = options.dataType ? options.dataType.toLowerCase() == 'json' ? 'json' : options.dataType.toLowerCase() == 'text' ? 'text' : 'json' : 'json';
        this.wrapperDisplay = options.wrapperDisplay || 'inline-block';     //包裹chooseBtn或uploadBtn的div的display

        /*生命周期函数*/
        /**
         * beforeChoose() : 用户选择之前执行，返回true继续，false阻止用户选择
         * @param  null
         * @return  {boolean} 是否允许用户进行选择
         */
        this.beforeChoose = options.beforeChoose || emptyFunction;
        /**
         * chooseFile(file) : 用户选择文件后的触发的回调函数
         * @param file {File | string} 现代浏览器返回File对象，IE返回文件名
         * @return
         */
        this.chooseFile = options.chooseFile || emptyFunction;
        /**
         * beforeUpload(file,mill) : 用户上传之前执行，返回true继续，false阻止用户选择
         * @param file {File | string} 现代浏览器返回File对象，IE返回文件名
         * @param mill {long} 毫秒数，如果File对象已有毫秒数则返回一样的
         * @return  {boolean} 是否允许用户进行上传
         */
        this.beforeUpload = options.beforeUpload || emptyFunction;
        /**
         * doUpload(file,mill) : 上传动作(xhr send | form submit)执行后调用
         * @param file {File | string} 现代浏览器返回File对象，IE返回文件名
         * @param mill {long} 毫秒数，如果File对象已有毫秒数则返回一样的
         * @return
         */
        this.doUpload = options.doUpload || emptyFunction;
        /**
         * uploading(progress) : 在文件上传中的时候，现代浏览器会不断触发此函数
         * @param progress {Progress} progress对象，里面存有例如上传进度loaded和文件大小total等属性
         * @return
         */
        this.uploading = options.uploading || emptyFunction;
        /**
         * uploadSuccess(resp) : 上传成功后执行的回调（针对AJAX而言）
         * @param resp {json | string} 根据options.dataType指定返回数据的格式
         * @return
         */
        this.uploadSuccess = options.uploadSuccess || emptyFunction;
        /**
         * uploadError(err) : 上传错误后执行的回调（针对AJAX而言）
         * @param err {Error | object} 如果返回catch到的error，其具有type和message属性
         * @return
         */
        this.uploadError = options.uploadError || emptyFunction;
        /**
         * uploadFail(resp) : 上传失败后执行的回调（针对AJAX而言）
         * @param resp {string} 失败信息
         */
        this.uploadFail = options.uploadFail || emptyFunction;


        this.files = options.files || false;        //保存需要上传的文件
        /*特殊内容*/
        this.filesToUpload = options.filesToUpload || [];       //如有要立即上传的文件，放入这个数组，然后在beforeUpload或者doUpload外部清除传入file，不支持IE
        this._withoutFileUpload = options._withoutFileUpload || false;      //不带文件上传，为了给秒传功能使用，不影响IE

        /*如果有要立即上传的文件，在此处执行上传*/
        if (this.filesToUpload.length && !this.isIE) {
            for (let i = 0, len = this.filesToUpload.length; i < len; i++) {
                this.files = [this.filesToUpload[i]];
                this.commonUpload();
            }
        }

        /*放置虚拟DOM*/
        let chooseBtn, uploadBtn, before = [], middle = [], after = [], flag = 0;
        if (this.chooseAndUpload) {
            React.Children.forEach(props.children, (child)=> {
                if (child.ref == 'chooseAndUpload') {
                    chooseBtn = child;
                    flag++;
                } else {
                    flag == 0 ? before.push(child) : flag == 1 ? middle.push(child) : '';
                }
            });
        } else {
            React.Children.forEach(props.children, (child)=> {
                if (child.ref == 'chooseBtn') {
                    chooseBtn = child;
                    flag++;
                } else if (child.ref == 'uploadBtn') {
                    uploadBtn = child;
                    flag++;
                } else {
                    flag == 0 ? before.push(child) : flag == 1 ? middle.push(child) : after.push(child);
                }
            });
        }
        this.setState({
            chooseBtn,
            uploadBtn,
            before,
            middle,
            after
        })
    },
    /*打包render函数*/
    packRender(){
        /*IE用iframe表单上传，其他用ajax Formdata*/
        let render = '';
        if (this.isIE) {
            render = this.multiIEForm(currentIEID);
        } else {
            render = (
                <div className={this.props.className} style={this.props.style}>
                    {this.state.before}
                    <div onClick={this.commonChooseFile}
                         style={{overflow:'hidden',postion:'relative',display:this.wrapperDisplay}}>
                        {this.state.chooseBtn}
                    </div>
                    {this.state.middle}

                    <div onClick={this.commonUpload}
                         style={{overflow:'hidden',postion:'relative',display:this.chooseAndUpload?'none':this.wrapperDisplay}}>
                        {this.state.uploadBtn}
                    </div>
                    {this.state.after}
                    <input type="file" id="ajax_upload_file_input" name="ajax_upload_file_input"
                            ref="ajax_upload_file_input" style={{display:"none"}} onChange={this.commonChange}/>
                </div>
            )
        }
        return render;
    },

    /*IE多文件同时上传，需要多个表单+多个form组合。根据currentIEID代表有多少个form。除了最后一个form（空闲）显示，其他为隐藏*/
    //TODO 把上传完毕的form和frame重新变为空闲
    multiIEForm(id){
        let formArr = [];
        let isEnd = false;
        for (let i = 0; i <= id; i++) {
            if (i == id) isEnd = true;
            formArr.push((
                <form id={`ajax_upload_file_form_${i}`} method="post" target={`ajax_upload_file_frame_${i}`}
                      key={`ajax_upload_file_form_${i}`}
                      encType="multipart/form-data" ref={`form_${i}`} onSubmit={this.IEUpload}
                      style={{display:isEnd? 'block':'none'}}>
                    {this.state.before}
                    <div style={{overflow:'hidden',position:'relative',display:'inline-block'}}>{/*display处理IE显示问题*/}
                        {this.state.chooseBtn}
                        {/*input file 的name不能省略*/}
                        <input type="file"
                               name={`ajax_upload_hidden_input_${i}`}
                               id={`ajax_upload_hidden_input_${i}`}
                               ref={`ajax_upload_hidden_input_${i}`}
                               onChange={this.IEChooseFile}
                               onClick={this.IEBeforeChoose}
                               style={{
                                    position:'absolute',
                                    left:'-30px',
                                    top:0,
                                    zIndex:'50',
                                    fontSize:'80px',
                                    width:'200px',
                                    opacity:0,
                                    filter:'alpha(opacity=0)'
                               }}
                            />
                    </div>
                    {this.state.middle}
                    <div
                        style={{overflow:'hidden',position:'relative',display:this.chooseAndUpload?'none':this.wrapperDisplay}}>
                        {this.state.uploadBtn}
                        <input type="submit"
                               style={{
                                    position:'absolute',
                                    left:0,
                                    top:0,
                                    fontSize:'50px',
                                    width:'200px',
                                    opacity:0
                               }}
                            />
                    </div>
                    {this.state.after}
                </form>
            ));
            formArr.push((
                <iframe id={`ajax_upload_file_frame_${i}`} name={`ajax_upload_file_frame_${i}`}
                        key={`ajax_upload_file_frame_${i}`}
                        className="ajax_upload_file_frame">
                </iframe>
            ))
        }
        return (
            <div className={this.props.className} style={this.props.style} id="react-file-uploader">
                {formArr}
            </div>

        )
    },

    /*触发隐藏的input框选择*/
    /*触发beforeChoose*/
    commonChooseFile(){
        let jud = this.beforeChoose();
        if (jud != true && jud != undefined) return;
        this.refs['ajax_upload_file_input'].getDOMNode().click();
    },
    /*现代浏览器input change事件。File API保存文件*/
    /*触发chooseFile*/
    commonChange(e){
        let files;
        if (e.dataTransfer) {
            files = e.dataTransfer.files;
        } else if (e.target) {
            files = e.target.files;
        }
        this.files = files;
        this.chooseFile(files);
        if (this.chooseAndUpload) {
            this.commonUpload();
        }
    },
    /*iE选择前验证*/
    /*触发beforeChoose*/
    IEBeforeChoose(e){
        let jud = this.beforeChoose();
        if (jud != true && jud != undefined) e.preventDefault();
        e.target.blur();
    },
    /*IE需要用户真实点击上传按钮，所以使用透明按钮*/
    /*触发chooseFile*/
    IEChooseFile(e){
        this.fileName = e.target.value.substring(e.target.value.lastIndexOf('\\') + 1);
        this.chooseFile(this.fileName);
        if (this.chooseAndUpload && (this.IEUpload() !== false)) {
            document.getElementById(`ajax_upload_file_form_${currentIEID - 1}`).submit();
        }
    },
    /*IE处理上传函数*/
    /*触发beforeUpload doUpload*/
    IEUpload(e){
        let mill = (new Date).getTime();
        let jud = this.beforeUpload(this.fileName, mill);
        if (jud != true && jud != undefined) return false;

        let that = this;
        if (!this.fileName) {
            console.log('no filename')
            if (e) e.preventDefault();
            return false;
        }
        /*url参数*/
        let baseUrl = this.baseUrl;
        let param = this.param;
        let paramStr = '';
        let paramAddToFile = {};
        if (param) {
            let paramArr = [];
            param['_'] = mill;
            param['ie'] = 'true';
            for (let i in param) {
                paramArr.push(`${i}=${param[i]}`)
            }
            paramStr = '?' + paramArr.join('&');

            for (let i = 0, len = this.paramAddToFile.length; i < len; i++) {
                paramAddToFile[this.paramAddToFile[i]] = param[this.paramAddToFile[i]];
            }
        }
        let targeturl = baseUrl + paramStr;
        document.getElementById(`ajax_upload_file_form_${currentIEID}`).setAttribute('action', targeturl);
        /*当前上传id*/
        let partIEID = currentIEID;
        /*回调函数*/
        document.getElementById(`ajax_upload_file_frame_${partIEID}`).attachEvent('onload',function(e){
            console.log('load', partIEID);
            try {
                that.uploadSuccess(that.IECallback(that.dataType, partIEID));
            } catch (e) {
                that.uploadError(e);
            } finally {
                /*清除输入框的值*/
                let oInput = that.refs[`ajax_upload_hidden_input_${partIEID}`].getDOMNode();
                oInput.outerHTML = oInput.outerHTML;
            }
        });
        this.doUpload(this.fileName, mill, paramAddToFile);
        currentIEID++;
    },
    /*IE回调函数*/
    //TODO 处理Timeout
    IECallback(dataType, frameId){
        let frame = document.getElementById(`ajax_upload_file_frame_${frameId}`);
        let resp = {};
        let content = frame.contentWindow ? frame.contentWindow.document.body : frame.contentDocument.document.body;
        if (!content) throw new Error('Your browser does not support async upload');
        try {
            resp.responseText = content.innerHTML || 'null innerHTML';
            resp.json = JSON ? JSON.parse(resp.responseText) : eval(`(${resp.responseText})`);
        } catch (e) {
            /*如果是包含了<pre>*/
            if (e.message && e.message.indexOf('Unexpected token') >= 0) {
                /*包含返回的json*/
                if (resp.responseText.indexOf('{') >= 0) {
                    let msg = resp.responseText.substring(resp.responseText.indexOf('{'), resp.responseText.lastIndexOf('}') + 1);
                    return JSON ? JSON.parse(msg) : eval(`(${msg})`);
                }
                return {type: 'FINISHERROR', message: e.message};
            }
            throw e;
        }
        return dataType == 'json' ? resp.json : resp.responseText;
    },
    /*执行上传*/
    commonUpload(){
        /*mill参数是当前时刻毫秒数，file第一次进行上传时会添加为file的属性，也可在beforeUpload为其添加，之后同一文件的mill不会更改，作为文件的识别id*/
        let mill = (this.files.length && this.files[0].mill) || (new Date).getTime();
        let jud = this.beforeUpload(this.files, mill);
        if (jud != true && jud != undefined) {
            /*清除input的值*/
            this.refs['ajax_upload_file_input'].getDOMNode().value = '';
            return;
        }

        if (!this.files) return;
        if (!this.baseUrl) {
            throw new Error('BaseUrl missing in options');
        }
        let formData = new FormData();
        if (!this._withoutFileUpload) {
            for (let i = 0, len = this.files.length; i < len; i++) {
                formData.append(this.files[i].name, this.files[i]);
            }
        }
        /*url参数*/
        let that = this;
        let baseUrl = this.baseUrl;
        let param = this.param;
        let paramStr = '';
        if (param) {
            let paramArr = [];
            param['_'] = mill;
            for (let i in param) {
                paramArr.push(`${i}=${param[i]}`)
            }
            paramStr = '?' + paramArr.join('&');

            for (let i = 0, len = this.paramAddToFile.length; i < len; i++) {
                if (param[this.paramAddToFile[i]]) {
                    this.files[0][this.paramAddToFile[i]] = param[this.paramAddToFile[i]];
                }
            }
        }
        let targeturl = baseUrl + paramStr;

        /*AJAX上传部分*/
        let xhr = new XMLHttpRequest();
        xhr.open('POST', targeturl, true);
        //xhr.setRequestHeader('Content-Type','application/x-www-form-urlencoded; charset=UTF-8');

        xhr.onreadystatechange = function () {
            /*xhr finish*/
            try {
                if (xhr.readyState == 4 && xhr.status >= 200 && xhr.status < 400) {
                    let resp = that.dataType == 'json' ? JSON.parse(xhr.responseText) : xhr.responseText;
                    that.uploadSuccess(resp)
                } else if (xhr.readyState == 4) {
                    /*xhr fail*/
                    let resp = that.dataType == 'json' ? JSON.parse(xhr.responseText) : xhr.responseText;
                    that.uploadFail(resp)
                }
            } catch (e) {
                that.uploadError({type: 'FINISHERROR', message: e.message});
            }
        };
        /*xhr error*/
        xhr.onerror = function () {
            try {
                let resp = that.dataType == 'json' ? JSON.parse(xhr.responseText) : xhr.responseText;
                that.uploadError({type: 'XHRERROR', message: resp});
            } catch (e) {
                that.uploadError({type: 'XHRERROR', message: e.message});
            }
        }
        /*这里部分浏览器实现不一致，而且IE没有这个方法*/
        xhr.onprogress = xhr.upload.onprogress = function (progress) {
            that.uploading(progress, mill);
        }
        /*不带文件上传，给秒传使用*/
        this._withoutFileUpload ? xhr.send(null) : xhr.send(formData);

        /*trigger执行上传的用户回调*/
        this.doUpload(this.files, mill);

        /*清除input的值*/
        this.refs['ajax_upload_file_input'].getDOMNode().value = '';
    },
    /*判断ie版本*/
    checkIE() {
        let userAgent = navigator.userAgent;
        let version = userAgent.indexOf('MSIE');
        if (version < 0) {
            return -1;
        }
        return parseFloat(userAgent.substring(version + 5, userAgent.indexOf(";", version)));
    },

})

module.exports = FileUpload;