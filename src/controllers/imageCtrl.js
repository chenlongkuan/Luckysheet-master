import { mouseposition } from '../global/location';
import server from './server';
import luckysheetsizeauto from './resize';
import { modelHTML } from './constant';
import { checkProtectionAuthorityNormal } from './protection';
import { getSheetIndex } from '../methods/get';
import { setluckysheet_scroll_status, setluckysheet_select_save } from '../methods/set';
import { selectHightlightShow } from "../controllers/select";
import { getdatabyselection } from "../global/getdata";
import { setcellvalue } from "../global/setdata";
import { replaceHtml, generateRandomId, findIndexById } from '../utils/util';
import Store from '../store';
import locale from '../locale/locale';
import tooltip from '../global/tooltip';
import method from '../global/method';
import editor from '../global/editor';
import { getRowHeight, getColumnWidth } from '../global/api';

const imageCtrl = {
    imgItem: {
        type: '3',  //1移动并调整单元格大小 2移动并且不调整单元格的大小 3不要移动单元格并调整其大小
        src: '',  //图片url
        originWidth: null,  //图片原始宽度
        originHeight: null,  //图片原始高度
        default: {
            width: null,  //图片 宽度
            height: null,  //图片 高度
            left: null,  //图片离表格左边的 位置
            top: null,  //图片离表格顶部的 位置
        },
        crop: {
            width: null,  //图片裁剪后 宽度
            height: null,  //图片裁剪后 高度
            offsetLeft: 0,  //图片裁剪后离未裁剪时 左边的位移
            offsetTop: 0,  //图片裁剪后离未裁剪时 顶部的位移
        },
        isFixedPos: false,  //固定位置
        fixedLeft: null,  //固定位置 左位移
        fixedTop: null,  //固定位置 右位移
        border: {
            width: 0,  //边框宽度
            radius: 0,  //边框半径
            style: 'solid',  //边框类型
            color: '#000',  //边框颜色
        }
    },
    images: null,
    currentImgId: null,
    currentWinW: null,
    currentWinH: null,
    resize: null,
    resizeXY: null,
    move: false,
    moveXY: null,
    cropChange: null,
    cropChangeXY: null,
    cropChangeObj: null,
    copyImgItemObj: null,
    insertImg: function (file) {
        var selectedData = getdatabyselection();
        var isSelectMultiCell = selectedData.length > 1 || selectedData[0].length > 1;//是否多选了单元格
        if (isSelectMultiCell) {//多选单元格时，不支持插入图片，提示用户取消多选，选择单个单元格再插入图片。
            tooltip.info('<i class="fa fa-exclamation-triangle"></i>', '请取消多选，选择单个单元格再插入图片');
            return false;//返回false，取消插入图片操作。
        }
        const uploadImage = Store.toJsonOptions && Store.toJsonOptions['uploadImage'];
        if (typeof uploadImage === 'function') {
            // 上传形式
            uploadImage(file).then(url => {
                imageCtrl._insertImg(url);
            }).catch(error => {
                console.log(error);
                tooltip.info('<i class="fa fa-exclamation-triangle"></i>', '图片上传失败');
            });
        } else {
            // 内部base64形式
            let render = new FileReader();
            render.readAsDataURL(file);

            render.onload = function (event) {
                let src = event.target.result;
                imageCtrl._insertImg(src);
                $("#luckysheet-imgUpload").val("");
            }
        }
    },
    /**
     * 插入图片，不上传
     * @param {string} src 图片src
     * @param {number} toRow 插入到的行坐标(dropcell-update使用，即拖动单元格复制图片)
     * @param {number} toCol 插入到的列坐标(dropcell-update使用，即拖动单元格复制图片)
     * @param {string} imgId 插入图片的新id(dropcell-update使用，即拖动单元格复制图片)
     */
    _insertImg: function (src, toRow, toCol, imgId, toCellId) {
        let _this = this;

        let last = Store.luckysheet_select_save[Store.luckysheet_select_save.length - 1];
        let rowIndex = toRow || last.row_focus || 0;
        let colIndex = toCol || last.column_focus || 0;
        let left = colIndex == 0 ? 0 : Store.visibledatacolumn[colIndex - 1];
        let top = rowIndex == 0 ? 0 : Store.visibledatarow[rowIndex - 1];
        if (Store.flowdata[rowIndex][colIndex].imgId) {
            this.removeImgItem(Store.flowdata[rowIndex][colIndex].imgId);//删除之前插入的图片
        }
        let image = new Image();
        image.onload = function () {
            let width = image.width,
                height = image.height;

            let img = {
                id: imgId,
                src: src,
                left: left,
                top: top,
                originWidth: width,
                originHeight: height
            }

            _this.addImgItem(img, toRow, toCol, toCellId);//插入图片到指定行列
        }
        let imageUrlHandle = Store.toJsonOptions && Store.toJsonOptions['imageUrlHandle'];
        image.src = typeof imageUrlHandle === 'function' ? imageUrlHandle(src, rowIndex, colIndex) : src;
    },
    modelHtml: function (id, imgItem) {
        let _this = this;

        let imageUrlHandle = Store.toJsonOptions && Store.toJsonOptions['imageUrlHandle'];
        let src = typeof imageUrlHandle === 'function' ? imageUrlHandle(imgItem.src) : imgItem.src;
        let imgItemParam = _this.getImgItemParam(imgItem);

        let width = imgItemParam.width;
        let height = imgItemParam.height;
        let left = imgItemParam.left;
        let top = imgItemParam.top;
        let position = imgItemParam.position;

        let borderWidth = imgItem.border.width;

        return `<div id="${id}" cellid="${imgItem.cellId}" class="luckysheet-modal-dialog luckysheet-modal-dialog-image" style="width:${width}px;height:${height}px;padding:0;position:${position};left:${left}px;top:${top}px;z-index:200;">
                    <div class="luckysheet-modal-dialog-content" style="width:100%;height:100%;overflow:hidden;position:relative;">
                        <img src="${src}" style="position:absolute;width:${imgItem.default.width * Store.zoomRatio}px;height:${imgItem.default.height * Store.zoomRatio}px;left:${-imgItem.crop.offsetLeft * Store.zoomRatio}px;top:${-imgItem.crop.offsetTop * Store.zoomRatio}px;" />
                    </div>
                    <div class="luckysheet-modal-dialog-border" style="border:${borderWidth}px ${imgItem.border.style} ${imgItem.border.color};border-radius:${imgItem.border.radius * Store.zoomRatio}px;position:absolute;left:${-borderWidth}px;right:${-borderWidth}px;top:${-borderWidth}px;bottom:${-borderWidth}px;"></div>
                </div>`;
    },
    getSliderHtml: function () {
        let imageText = locale().imageText;

        return `<div id="luckysheet-modal-dialog-slider-imageCtrl" class="luckysheet-modal-dialog-slider luckysheet-modal-dialog-slider-imageCtrl" style="display:block;">
                    <div class="luckysheet-modal-dialog-slider-title">
                        <span>${imageText.imageSetting}</span>
                        <span class="luckysheet-model-close-btn" title="${imageText.close}">
                            <i class="fa fa-times" aria-hidden="true"></i>
                        </span>
                    </div>
                    <div class="luckysheet-modal-dialog-slider-content">
                        <div class="slider-box">
                            <div class="slider-box-title">${imageText.conventional}</div>
                            <div class="slider-box-radios">
                                <div class="radio-item">
                                    <input type="radio" id="imgItemType1" name="imgItemType" value="1">
                                    <label for="imgItemType1">${imageText.moveCell1}</label>
                                </div>
                                <div class="radio-item">
                                    <input type="radio" id="imgItemType2" name="imgItemType" value="2">
                                    <label for="imgItemType2">${imageText.moveCell2}</label>
                                </div>
                                <div class="radio-item">
                                    <input type="radio" id="imgItemType3" name="imgItemType" value="3">
                                    <label for="imgItemType3">${imageText.moveCell3}</label>
                                </div>
                            </div>
                            <div class="slider-box-checkbox">
                                <input type="checkbox" id="imgItemIsFixedPos">
                                <label for="imgItemIsFixedPos">${imageText.fixedPos}</label>
                            </div>
                        </div>
                        <div class="slider-box">
                            <div class="slider-box-title">${imageText.border}</div>
                            <div class="slider-box-borderConfig">
                                <div class="border-item">
                                    <label>${imageText.width}</label>
                                    <input type="number" id="imgItemBorderWidth" min="0">
                                </div>
                                <div class="border-item">
                                    <label>${imageText.radius}</label>
                                    <input type="number" id="imgItemBorderRadius" min="0">
                                </div>
                                <div class="border-item">
                                    <label>${imageText.style}</label>
                                    <select id="imgItemBorderStyle">
                                        <option value="solid">${imageText.solid}</option>
                                        <option value="dashed">${imageText.dashed}</option>
                                        <option value="dotted">${imageText.dotted}</option>
                                        <option value="double">${imageText.double}</option>
                                    </select>
                                </div>
                                <div class="border-item">
                                    <label>${imageText.color}</label>
                                    <div id="imgItemBorderColor" class="imgItemBorderColor">
                                        <span></span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>`;
    },
    sliderHtmlShow: function () {
        let _this = this;

        $("#luckysheet-modal-dialog-slider-imageCtrl").remove();

        let sliderHtml = _this.getSliderHtml();
        $("body").append(sliderHtml);
        luckysheetsizeauto();

        let imgItem = _this.images[_this.currentImgId];

        //类型
        let type = imgItem.type;
        $("#luckysheet-modal-dialog-slider-imageCtrl #imgItemType" + type).prop("checked", true);

        //固定位置
        let isFixedPos = imgItem.isFixedPos;
        $("#luckysheet-modal-dialog-slider-imageCtrl #imgItemIsFixedPos").prop("checked", isFixedPos);

        //边框宽度
        let border = imgItem.border;
        $("#luckysheet-modal-dialog-slider-imageCtrl #imgItemBorderWidth").val(border.width);
        $("#luckysheet-modal-dialog-slider-imageCtrl #imgItemBorderRadius").val(border.radius);
        $("#luckysheet-modal-dialog-slider-imageCtrl #imgItemBorderStyle").val(border.style);
        $("#luckysheet-modal-dialog-slider-imageCtrl #imgItemBorderColor span").css("background-color", border.color).attr("title", border.color);

        _this.init();
    },
    colorSelectDialog: function (currenColor) {
        const _locale = locale();
        const locale_button = _locale.button;
        const locale_toolbar = _locale.toolbar;
        const locale_imageCtrl = _locale.imageCtrl;

        $("#luckysheet-modal-dialog-mask").show();
        $("#luckysheet-imageCtrl-colorSelect-dialog").remove();

        $("body").append(replaceHtml(modelHTML, {
            "id": "luckysheet-imageCtrl-colorSelect-dialog",
            "addclass": "luckysheet-imageCtrl-colorSelect-dialog",
            "title": locale_imageCtrl.borderTile,
            "content": `<div class="currenColor">
                            ${locale_imageCtrl.borderCur}:<span title="${currenColor}" style="background-color:${currenColor}"></span>
                        </div>
                        <div class="colorshowbox"></div>`,
            "botton": `<button id="luckysheet-imageCtrl-colorSelect-dialog-confirm" class="btn btn-primary">${locale_button.confirm}</button>
                        <button class="btn btn-default luckysheet-model-close-btn">${locale_button.cancel}</button>`,
            "style": "z-index:100003"
        }));
        let $t = $("#luckysheet-imageCtrl-colorSelect-dialog")
            .find(".luckysheet-modal-dialog-content")
            .css("min-width", 300)
            .end(),
            myh = $t.outerHeight(),
            myw = $t.outerWidth();
        let winw = $(window).width(), winh = $(window).height();
        let scrollLeft = $(document).scrollLeft(), scrollTop = $(document).scrollTop();
        $("#luckysheet-imageCtrl-colorSelect-dialog").css({
            "left": (winw + scrollLeft - myw) / 2,
            "top": (winh + scrollTop - myh) / 3
        }).show();

        //初始化选择颜色插件
        $("#luckysheet-imageCtrl-colorSelect-dialog").find(".colorshowbox").spectrum({
            showPalette: true,
            showPaletteOnly: true,
            preferredFormat: "hex",
            clickoutFiresChange: false,
            showInitial: true,
            showInput: true,
            flat: true,
            hideAfterPaletteSelect: true,
            showSelectionPalette: true,
            showButtons: false,//隐藏选择取消按钮
            maxPaletteSize: 8,
            maxSelectionSize: 8,
            color: currenColor,
            cancelText: locale_button.cancel,
            chooseText: locale_toolbar.confirmColor,
            togglePaletteMoreText: locale_toolbar.customColor,
            togglePaletteLessText: locale_toolbar.collapse,
            togglePaletteOnly: true,
            clearText: locale_toolbar.clearText,
            noColorSelectedText: locale_toolbar.noColorSelectedText,
            localStorageKey: "spectrum.textcolor" + server.gridKey,
            palette: [
                ["#000", "#444", "#666", "#999", "#ccc", "#eee", "#f3f3f3", "#fff"],
                ["#f00", "#f90", "#ff0", "#0f0", "#0ff", "#00f", "#90f", "#f0f"],
                ["#f4cccc", "#fce5cd", "#fff2cc", "#d9ead3", "#d0e0e3", "#cfe2f3", "#d9d2e9", "#ead1dc"],
                ["#ea9999", "#f9cb9c", "#ffe599", "#b6d7a8", "#a2c4c9", "#9fc5e8", "#b4a7d6", "#d5a6bd"],
                ["#e06666", "#f6b26b", "#ffd966", "#93c47d", "#76a5af", "#6fa8dc", "#8e7cc3", "#c27ba0"],
                ["#c00", "#e69138", "#f1c232", "#6aa84f", "#45818e", "#3d85c6", "#674ea7", "#a64d79"],
                ["#900", "#b45f06", "#bf9000", "#38761d", "#134f5c", "#0b5394", "#351c75", "#741b47"],
                ["#600", "#783f04", "#7f6000", "#274e13", "#0c343d", "#073763", "#20124d", "#4c1130"]
            ],
            move: function (color) {
                if (color != null) {
                    color = color.toHexString();
                }
                else {
                    color = "#000";
                }

                $("#luckysheet-imageCtrl-colorSelect-dialog .currenColor span").css("background-color", color).attr("title", color);
            }
        });
    },
    init: function () {
        let _this = this;

        //关闭
        $("#luckysheet-modal-dialog-slider-imageCtrl .luckysheet-model-close-btn").click(function () {
            $("#luckysheet-modal-dialog-slider-imageCtrl").hide();
            luckysheetsizeauto();
        });

        //常规
        $("#luckysheet-modal-dialog-slider-imageCtrl").off("change.radio").on("change.radio", ".radio-item input[type=radio][name=imgItemType]", function () {
            _this.configChange("type", this.value);
        })

        //固定位置
        $("#luckysheet-modal-dialog-slider-imageCtrl").off("change.checkbox").on("change.checkbox", ".slider-box-checkbox input[type=checkbox]", function () {
            _this.configChange("fixedPos", this.checked);
        })

        //边框宽度
        $("#luckysheet-modal-dialog-slider-imageCtrl").off("change.borderWidth").on("change.borderWidth", "#imgItemBorderWidth", function () {
            _this.configChange("border-width", this.valueAsNumber);
        })

        //边框半径
        $("#luckysheet-modal-dialog-slider-imageCtrl").off("change.borderRadius").on("change.borderRadius", "#imgItemBorderRadius", function () {
            _this.configChange("border-radius", this.valueAsNumber);
        })

        //边框样式
        $("#luckysheet-modal-dialog-slider-imageCtrl").off("change.borderStyle").on("change.borderStyle", "#imgItemBorderStyle", function () {
            _this.configChange("border-style", this.value);
        })

        //边框颜色 选择
        $("#luckysheet-modal-dialog-slider-imageCtrl").off("click.color").on("click.color", "#imgItemBorderColor", function () {
            let currenColor = $(this).find("span").attr("title");
            _this.colorSelectDialog(currenColor);
        })

        //边框选择颜色 确定 
        $(document).off("click.selectColorConfirm").on("click.selectColorConfirm", "#luckysheet-imageCtrl-colorSelect-dialog-confirm", function () {
            let $parent = $(this).parents("#luckysheet-imageCtrl-colorSelect-dialog");
            $("#luckysheet-modal-dialog-mask").hide();
            $parent.hide();

            let currenColor = $parent.find(".currenColor span").attr("title");
            $("#luckysheet-modal-dialog-slider-imageCtrl #imgItemBorderColor span").css("background-color", currenColor).attr("title", currenColor);

            _this.configChange("border-color", currenColor);
        });

        //image 双击
        $("#luckysheet-image-showBoxs").off("dblclick").on("dblclick", ".luckysheet-modal-dialog-image", function (e) {
            e.stopPropagation();
            // $(this).hide();
            let id = $(this).attr("id");
            //取消其他图片的选中状态
            if (_this.currentImgId != null && _this.currentImgId != id) {
                _this.cancelActiveImgItem();
            }
            _this.currentImgId = id;
            let imageUrlHandle = Store.toJsonOptions && Store.toJsonOptions['imageUrlHandle'];
            const dbClickImageHandler = Store.toJsonOptions && Store.toJsonOptions['dbClickImageHandler'];//选中图片自定义处理函数
            if (typeof dbClickImageHandler === 'function') {
                _this.currentImgId = id;
                let item = _this.images[_this.currentImgId];//当前图片对象
                var cellPosition = findIndexById(Store.flowdata, item.cellId);//单元格所在行列位置
                let allImgUrlArr = []; //图片地址数组，用于自定义处理函数中获取图片地址
                for (let imgId in _this.images) {
                    let imgItem = _this.images[imgId];
                    let imgUrl = typeof imageUrlHandle === 'function' ? imageUrlHandle(imgItem.src) : imgItem.src;
                    allImgUrlArr.push(imgUrl);
                }
                var curImgUrl = item.src;//当前图片地址
                curImgUrl = typeof imageUrlHandle === 'function' ? imageUrlHandle(curImgUrl) : curImgUrl;
                dbClickImageHandler({ curImgId: _this.currentImgId, curImgUrl: curImgUrl, allImgUrlArr, cellPosition });
            }
        });

        //image active
        $("#luckysheet-image-showBoxs").off("mousedown.active").on("mousedown.active", ".luckysheet-modal-dialog-image", function (e) {
            e.stopPropagation();
            // $(this).hide();
            let id = $(this).attr("id");
            //取消其他图片的选中状态
            // if (_this.currentImgId != null && _this.currentImgId != id) {
            //     _this.cancelActiveImgItem();
            // }
            _this.currentImgId = id;
            let item = _this.images[_this.currentImgId];//当前图片对象
            var cellPosition = findIndexById(Store.flowdata, item.cellId);//单元格所在行列位置
            //选中当前单元格
            setluckysheet_select_save([{ row: [cellPosition.row, cellPosition.row], column: [cellPosition.col, cellPosition.col] }]);
            selectHightlightShow();
            let imageUrlHandle = Store.toJsonOptions && Store.toJsonOptions['imageUrlHandle'];
            const activeImageHandler = Store.toJsonOptions && Store.toJsonOptions['activeImageHandler'];//选中图片自定义处理函数
            if (typeof activeImageHandler === 'function') {
                let allImgUrlArr = []; //图片地址数组，用于自定义处理函数中获取图片地址
                for (let imgId in _this.images) {
                    let imgItem = _this.images[imgId];
                    let imgUrl = typeof imageUrlHandle === 'function' ? imageUrlHandle(imgItem.src) : imgItem.src;
                    allImgUrlArr.push(imgUrl);
                }
                var curImgUrl = item.src;//当前图片地址
                curImgUrl = typeof imageUrlHandle === 'function' ? imageUrlHandle(curImgUrl) : curImgUrl;
                activeImageHandler({ curImgId: _this.currentImgId, curImgUrl: curImgUrl, allImgUrlArr, cellPosition });
            } else {
                $(this).hide();
                if (!checkProtectionAuthorityNormal(Store.currentSheetIndex, "editObjects", false)) {
                    return;
                }
                let imgItemParam = _this.getImgItemParam(item);
                let width = imgItemParam.width;
                let height = imgItemParam.height;
                let left = imgItemParam.left;
                let top = imgItemParam.top;
                let position = imgItemParam.position;

                $("#luckysheet-modal-dialog-activeImage").show().css({
                    "width": width,
                    "height": height,
                    "left": left,
                    "top": top,
                    "position": position
                });
                let imgUrl = typeof imageUrlHandle === 'function' ? imageUrlHandle(item.src) : item.src;
                $("#luckysheet-modal-dialog-activeImage .luckysheet-modal-dialog-content").css({
                    "background-image": "url(" + imgUrl + ")",
                    "background-size": item.default.width * Store.zoomRatio + "px " + item.default.height * Store.zoomRatio + "px",
                    "background-position": -item.crop.offsetLeft * Store.zoomRatio + "px " + -item.crop.offsetTop * Store.zoomRatio + "px"
                })

                $("#luckysheet-modal-dialog-activeImage .luckysheet-modal-dialog-border").css({
                    "border-width": item.border.width * Store.zoomRatio,
                    "border-style": item.border.style,
                    "border-color": item.border.color,
                    "border-radius": item.border.radius * Store.zoomRatio,
                    "left": -item.border.width * Store.zoomRatio,
                    "right": -item.border.width * Store.zoomRatio,
                    "top": -item.border.width * Store.zoomRatio,
                    "bottom": -item.border.width * Store.zoomRatio,
                })

                _this.sliderHtmlShow();
            }
        })

        //image move
        $("#luckysheet-modal-dialog-activeImage").off("mousedown.move").on("mousedown.move", ".luckysheet-modal-dialog-content", function (e) {
            if (!checkProtectionAuthorityNormal(Store.currentSheetIndex, "editObjects", false)) {
                return;
            }

            if (!$("#luckysheet-modal-dialog-slider-imageCtrl").is(":visible")) {
                _this.sliderHtmlShow();
            }

            _this.move = true;

            _this.currentWinW = $("#luckysheet-cell-main")[0].scrollWidth;
            _this.currentWinH = $("#luckysheet-cell-main")[0].scrollHeight;

            let offset = $("#luckysheet-modal-dialog-activeImage").offset();

            _this.moveXY = [
                e.pageX - offset.left,
                e.pageY - offset.top,
            ];

            setluckysheet_scroll_status(true);

            e.stopPropagation();
        })

        //image resize
        $("#luckysheet-modal-dialog-activeImage").off("mousedown.resize").on("mousedown.resize", ".luckysheet-modal-dialog-resize-item", function (e) {
            if (!checkProtectionAuthorityNormal(Store.currentSheetIndex, "editObjects", false)) {
                return;
            }

            _this.currentWinW = $("#luckysheet-cell-main")[0].scrollWidth;
            _this.currentWinH = $("#luckysheet-cell-main")[0].scrollHeight;

            _this.resize = $(this).data("type");

            let scrollTop = $("#luckysheet-cell-main").scrollTop(),
                scrollLeft = $("#luckysheet-cell-main").scrollLeft();
            let mouse = mouseposition(e.pageX, e.pageY);
            let x = mouse[0] + scrollLeft;
            let y = mouse[1] + scrollTop;

            let position = $("#luckysheet-modal-dialog-activeImage").position();
            let width = $("#luckysheet-modal-dialog-activeImage").width();
            let height = $("#luckysheet-modal-dialog-activeImage").height();

            _this.resizeXY = [
                x,
                y,
                width,
                height,
                position.left + scrollLeft,
                position.top + scrollTop,
                scrollLeft,
                scrollTop
            ];

            setluckysheet_scroll_status(true);

            e.stopPropagation();
        })

        //image croppingEnter
        $("#luckysheet-modal-dialog-activeImage").off("mousedown.croppingEnter").on("mousedown.croppingEnter", ".luckysheet-modal-controll-crop", function (e) {
            _this.croppingEnter();
            e.stopPropagation();
        })

        //image croppingExit
        $("#luckysheet-modal-dialog-cropping").off("mousedown.croppingExit").on("mousedown.croppingExit", ".luckysheet-modal-controll-crop", function (e) {
            _this.croppingExit();
            e.stopPropagation();
        })

        //image crop change
        $("#luckysheet-modal-dialog-cropping").off("mousedown.cropChange").on("mousedown.cropChange", ".resize-item", function (e) {
            _this.cropChange = $(this).data("type");

            let scrollTop = $("#luckysheet-cell-main").scrollTop(),
                scrollLeft = $("#luckysheet-cell-main").scrollLeft();
            let mouse = mouseposition(e.pageX, e.pageY);
            let x = mouse[0] + scrollLeft;
            let y = mouse[1] + scrollTop;

            _this.cropChangeXY = [
                x,
                y
            ];

            setluckysheet_scroll_status(true);

            e.stopPropagation();
        })

        //image restore
        $("#luckysheet-image-showBoxs").off("mousedown.restore").on("mousedown.restore", ".luckysheet-modal-controll-restore", function (e) {
            _this.restoreImgItem();
            e.stopPropagation();
        })

        //image delete
        $("#luckysheet-image-showBoxs").off("mousedown.delete").on("mousedown.delete", ".luckysheet-modal-controll-del", function (e) {
            _this.removeImgItem();
            e.stopPropagation();
        })
    },
    configChange: function (type, value) {
        let _this = this;

        let imgItem = _this.images[_this.currentImgId];

        switch (type) {
            case "type":
                imgItem.type = value;
                break;
            case "fixedPos":
                imgItem.isFixedPos = value;

                let imgItemParam = _this.getImgItemParam(imgItem);
                let width = imgItemParam.width;
                let height = imgItemParam.height;
                let left = imgItemParam.left;
                let top = imgItemParam.top;
                let position = imgItemParam.position;

                $("#luckysheet-modal-dialog-activeImage").show().css({
                    "width": width,
                    "height": height,
                    "left": left,
                    "top": top,
                    "position": position
                });
                break;
            case "border-width":
                imgItem.border.width = value;
                $("#luckysheet-modal-dialog-activeImage .luckysheet-modal-dialog-border").css({
                    "border-width": value,
                    "left": -value,
                    "right": -value,
                    "top": -value,
                    "bottom": -value
                });
                break;
            case "border-radius":
                imgItem.border.radius = value;
                $("#luckysheet-modal-dialog-activeImage .luckysheet-modal-dialog-border").css("border-radius", value);
                break;
            case "border-style":
                imgItem.border.style = value;
                $("#luckysheet-modal-dialog-activeImage .luckysheet-modal-dialog-border").css("border-style", value);
                break;
            case "border-color":
                imgItem.border.color = value;
                $("#luckysheet-modal-dialog-activeImage .luckysheet-modal-dialog-border").css("border-color", value);
                break;
        }

        _this.ref();
    },
    getImgItemParam(imgItem) {
        let isFixedPos = imgItem.isFixedPos;

        let width = imgItem.default.width * Store.zoomRatio,
            height = imgItem.default.height * Store.zoomRatio,
            left = imgItem.default.left * Store.zoomRatio,
            top = imgItem.default.top * Store.zoomRatio;

        if (imgItem.crop.width != width || imgItem.crop.height != height) {
            width = imgItem.crop.width * Store.zoomRatio;
            height = imgItem.crop.height * Store.zoomRatio;
            left += imgItem.crop.offsetLeft * Store.zoomRatio;
            top += imgItem.crop.offsetTop * Store.zoomRatio;
        }

        let position = 'absolute';
        if (isFixedPos) {
            position = 'fixed';
            left = imgItem.fixedLeft + imgItem.crop.offsetLeft;
            top = imgItem.fixedTop + imgItem.crop.offsetTop;

            // only need to scale the distance relative to the main area, otherwise it will continue to shift and overflow the main area.
            // Note: After scaling here, there is no need to scale again when using this position externally
            // fix #174
            const operateAreaWidth = Store.rowHeaderWidth;
            const operateAreaHeight = Store.infobarHeight + Store.toolbarHeight + Store.calculatebarHeight + Store.columnHeaderHeight;
            left = (left - operateAreaWidth) * Store.zoomRatio + operateAreaWidth
            top = (top - operateAreaHeight) * Store.zoomRatio + operateAreaHeight
        }

        return {
            width: width,
            height: height,
            left: left,
            top: top,
            position: position
        }
    },
    cancelActiveImgItem: function () {
        let _this = this;

        $("#luckysheet-modal-dialog-activeImage").hide();
        $("#luckysheet-modal-dialog-cropping").hide();
        $("#luckysheet-modal-dialog-slider-imageCtrl").hide();

        let imgItem = _this.images[_this.currentImgId];
        if (!imgItem) return;
        let imgItemParam = _this.getImgItemParam(imgItem);

        let width = imgItemParam.width;
        let height = imgItemParam.height;
        let left = imgItemParam.left;
        let top = imgItemParam.top;
        let position = imgItemParam.position;

        $("#" + _this.currentImgId).show().css({
            "width": width,
            "height": height,
            "left": left,
            "top": top,
            "position": position
        });
        $("#" + _this.currentImgId + " img").css({
            "width": imgItem.default.width * Store.zoomRatio,
            "height": imgItem.default.height * Store.zoomRatio,
            "left": -imgItem.crop.offsetLeft * Store.zoomRatio,
            "top": -imgItem.crop.offsetTop * Store.zoomRatio
        });
        $("#" + _this.currentImgId + " .luckysheet-modal-dialog-border").css({
            "border-width": imgItem.border.width * Store.zoomRatio,
            "border-style": imgItem.border.style,
            "border-color": imgItem.border.color,
            "border-radius": imgItem.border.radius * Store.zoomRatio,
            "left": -imgItem.border.width * Store.zoomRatio,
            "right": -imgItem.border.width * Store.zoomRatio,
            "top": -imgItem.border.width * Store.zoomRatio,
            "bottom": -imgItem.border.width * Store.zoomRatio,
        })

        _this.currentImgId = null;
    },
    /**
     * 
     * @param {object} img 
     * @param {number} toRow 插入到的行坐标(dropcell-update使用，即拖动单元格复制图片)
     * @param {number} toCol 插入到的列坐标(dropcell-update使用，即拖动单元格复制图片)
     */
    addImgItem: function (img, toRow, toCol, toCellId) {
        let _this = this;

        let width, height;
        let max = 400;

        if (img.originHeight < img.originWidth) {
            height = Math.round(img.originHeight * (max / img.originWidth));
            width = max;
        }
        else {
            width = Math.round(img.originWidth * (max / img.originHeight));
            height = max;
        }

        if (_this.images == null) {
            _this.images = {};
        }

        var rowIndex = toRow || Store.luckysheet_select_save[0].row_focus; // 获取图片所在行索引
        console.log("🚀 ~ rowIndex:", rowIndex)
        var colIndex = toCol || Store.luckysheet_select_save[0].column_focus; // 获取图片所在列索引
        console.log("🚀 ~ colIndex:", colIndex)
        const option_img_type = Store.toJsonOptions && Store.toJsonOptions['img_type'];//配置的图片类型
        let imgItem = $.extend(true, { cellId: toCellId || Store.flowdata[rowIndex][colIndex].id }, _this.imgItem);
        console.log("🚀 ~ imgItem:", imgItem)
        imgItem.type = option_img_type || _this.imgItem.type;
        imgItem.src = img.src;
        imgItem.originWidth = img.originWidth;
        imgItem.originHeight = img.originHeight;
        imgItem.default.width = getColumnWidth([colIndex])[colIndex];
        imgItem.default.height = getRowHeight([rowIndex])[rowIndex];
        imgItem.default.left = img.left;
        imgItem.default.top = img.top;
        imgItem.crop.width = imgItem.default.width;
        imgItem.crop.height = imgItem.default.height;

        let scrollTop = $("#luckysheet-cell-main").scrollTop(),
            scrollLeft = $("#luckysheet-cell-main").scrollLeft();

        imgItem.fixedLeft = img.left - scrollLeft + Store.rowHeaderWidth;
        imgItem.fixedTop = img.top - scrollTop + Store.infobarHeight + Store.toolbarHeight + Store.calculatebarHeight + Store.columnHeaderHeight;

        let id = img.id || generateRandomId();//img.id有值时表示：已在外部生成插入图片的新id(dropcell-update使用，即拖动单元格复制图片)
        let modelHtml = _this.modelHtml(id, imgItem);

        $("#luckysheet-image-showBoxs .img-list").append(modelHtml);
        Store.flowdata[rowIndex][colIndex].imgId = id;
        //赋值图片src给单元格
        setcellvalue(rowIndex, colIndex, Store.flowdata, img.src);
        //worker存数据
        editor.webWorkerFlowDataCache(Store.flowdata);
        _this.images[id] = imgItem;
        _this.ref();

        _this.init();
    },
    moveImgItem: function (moveId) {
        let _this = this;

        _this.move = false;

        let obj = $("#luckysheet-modal-dialog-activeImage")[0];
        let item = _this.images[moveId || _this.currentImgId];

        var zoomRatio = Store.zoomRatio;

        if (item.isFixedPos) {

            item.fixedLeft = (obj.offsetLeft - item.crop.offsetLeft) / zoomRatio;
            item.fixedTop = (obj.offsetTop - item.crop.offsetTop) / zoomRatio;
        }
        else {
            item.default.left = (obj.offsetLeft - item.crop.offsetLeft) / zoomRatio;
            item.default.top = (obj.offsetTop - item.crop.offsetTop) / zoomRatio;
        }

        _this.ref();
    },
    resizeImgItem: function () {
        let _this = this;

        _this.resize = null;

        var zoomRatio = Store.zoomRatio;

        let obj = $("#luckysheet-modal-dialog-activeImage")[0];

        let item = _this.images[_this.currentImgId];
        let scaleX = obj.clientWidth / item.crop.width;
        let scaleY = obj.clientHeight / item.crop.height;

        item.default.width = Math.round(item.default.width * scaleX / zoomRatio);
        item.default.height = Math.round(item.default.height * scaleY / zoomRatio);

        item.crop.width = Math.round(item.crop.width * scaleX / zoomRatio);
        item.crop.height = Math.round(item.crop.height * scaleY / zoomRatio);
        item.crop.offsetLeft = Math.round(item.crop.offsetLeft * scaleX / zoomRatio);
        item.crop.offsetTop = Math.round(item.crop.offsetTop * scaleY / zoomRatio);

        if (item.isFixedPos) {
            item.fixedLeft = obj.offsetLeft / zoomRatio;
            item.fixedTop = obj.offsetTop / zoomRatio;
        }
        else {
            item.default.left = (obj.offsetLeft - item.crop.offsetLeft) / zoomRatio;
            item.default.top = (obj.offsetTop - item.crop.offsetTop) / zoomRatio;
        }

        _this.ref();
    },
    croppingEnter: function () {
        let _this = this;
        _this.cropping = true;

        if (!checkProtectionAuthorityNormal(Store.currentSheetIndex, "editObjects", false)) {
            return;
        }

        $("#luckysheet-modal-dialog-activeImage").hide();
        $("#luckysheet-modal-dialog-slider-imageCtrl").hide();

        let item = _this.images[_this.currentImgId];
        let imgItemParam = _this.getImgItemParam(item);

        let width = imgItemParam.width;
        let height = imgItemParam.height;
        let left = imgItemParam.left;
        let top = imgItemParam.top;
        let position = imgItemParam.position;

        $("#luckysheet-modal-dialog-cropping").show().css({
            "width": width,
            "height": height,
            "left": left,
            "top": top,
            "position": position
        });

        let imageUrlHandle = Store.toJsonOptions && Store.toJsonOptions['imageUrlHandle'];
        let imgSrc = typeof imageUrlHandle === 'function' ? imageUrlHandle(item.src) : item.src;

        $("#luckysheet-modal-dialog-cropping .cropping-mask").css({
            "width": item.default.width,
            "height": item.default.height,
            "background-image": "url(" + imgSrc + ")",
            "left": -item.crop.offsetLeft,
            "top": -item.crop.offsetTop
        })

        $("#luckysheet-modal-dialog-cropping .cropping-content").css({
            "background-image": "url(" + imgSrc + ")",
            "background-size": item.default.width + "px " + item.default.height + "px",
            "background-position": -item.crop.offsetLeft + "px " + -item.crop.offsetTop + "px"
        })

        $("#luckysheet-modal-dialog-cropping .luckysheet-modal-dialog-border").css({
            "border-width": item.border.width,
            "border-style": item.border.style,
            "border-color": item.border.color,
            "border-radius": item.border.radius,
            "left": -item.border.width,
            "right": -item.border.width,
            "top": -item.border.width,
            "bottom": -item.border.width,
        })
    },
    croppingExit: function () {
        let _this = this;
        _this.cropping = false;

        $("#luckysheet-modal-dialog-cropping").hide();

        let item = _this.images[_this.currentImgId];
        let imgItemParam = _this.getImgItemParam(item);

        let width = imgItemParam.width;
        let height = imgItemParam.height;
        let left = imgItemParam.left;
        let top = imgItemParam.top;
        let position = imgItemParam.position;

        $("#luckysheet-modal-dialog-activeImage").show().css({
            "width": width,
            "height": height,
            "left": left,
            "top": top,
            "position": position
        });
        let imageUrlHandle = Store.toJsonOptions && Store.toJsonOptions['imageUrlHandle'];
        let imgSrc = typeof imageUrlHandle === 'function' ? imageUrlHandle(item.src) : item.src;

        $("#luckysheet-modal-dialog-activeImage .luckysheet-modal-dialog-content").css({
            "background-image": "url(" + imgSrc + ")",
            "background-size": item.default.width + "px " + item.default.height + "px",
            "background-position": -item.crop.offsetLeft + "px " + -item.crop.offsetTop + "px"
        })
    },
    cropChangeImgItem: function () {
        let _this = this;

        _this.cropChange = null;

        let item = _this.images[_this.currentImgId];
        item.crop.width = _this.cropChangeObj.width;
        item.crop.height = _this.cropChangeObj.height;
        item.crop.offsetLeft = _this.cropChangeObj.offsetLeft;
        item.crop.offsetTop = _this.cropChangeObj.offsetTop;

        _this.ref();
    },
    restoreImgItem: function () {
        let _this = this;
        let imgItem = _this.images[_this.currentImgId];

        imgItem.default.width = imgItem.originWidth;
        imgItem.default.height = imgItem.originHeight;

        imgItem.crop.width = imgItem.originWidth;
        imgItem.crop.height = imgItem.originHeight;
        imgItem.crop.offsetLeft = 0;
        imgItem.crop.offsetTop = 0;

        let imgItemParam = _this.getImgItemParam(imgItem);

        let width = imgItemParam.width;
        let height = imgItemParam.height;
        let left = imgItemParam.left;
        let top = imgItemParam.top;
        let position = imgItemParam.position;

        $("#luckysheet-modal-dialog-activeImage").show().css({
            "width": width,
            "height": height,
            "left": left,
            "top": top,
            "position": position
        });

        let imageUrlHandle = Store.toJsonOptions && Store.toJsonOptions['imageUrlHandle'];
        let imgSrc = typeof imageUrlHandle === 'function' ? imageUrlHandle(imgItem.src) : imgItem.src;

        $("#luckysheet-modal-dialog-activeImage .luckysheet-modal-dialog-content").css({
            "background-image": "url(" + imgSrc + ")",
            "background-size": imgItem.default.width + "px " + imgItem.default.height + "px",
            "background-position": -imgItem.crop.offsetLeft + "px " + -imgItem.crop.offsetTop + "px"
        })

        _this.ref();
    },
    removeImgItem: function (imgId) {
        let _this = this;
        let imgItem = _this.images[imgId || _this.currentImgId];

        // 钩子 imageDeleteBefore
        if (!imgItem || !method.createHookFunction('imageDeleteBefore', imgItem)) {
            return;
        }

        $("#luckysheet-modal-dialog-activeImage").hide();
        $("#luckysheet-modal-dialog-cropping").hide();
        $("#luckysheet-modal-dialog-slider-imageCtrl").hide();
        $("#" + (imgId || _this.currentImgId)).remove();


        delete _this.images[imgId || _this.currentImgId];
        _this.currentImgId = null;
        var cellPosition = findIndexById(Store.flowdata, imgItem.cellId);//单元格所在行列位置
        // 钩子 imageDeleteAfter
        method.createHookFunction('imageDeleteAfter', { imgItem, row: cellPosition.row, column: cellPosition.col });
        _this.ref();
    },
    copyImgItem: function (e) {
        let _this = this;

        _this.copyImgItemObj = $.extend(true, {}, _this.images[_this.currentImgId]);

        let clipboardData = window.clipboardData; //for IE
        if (!clipboardData) { // for chrome
            clipboardData = e.originalEvent.clipboardData;
        }

        let cpdata = '<table data-type="luckysheet_copy_action_image"><tr><td><td></tr></table>';

        if (!clipboardData) {
            let textarea = $("#luckysheet-copy-content");
            textarea.html(cpdata);
            textarea.focus();
            textarea.select();
            document.execCommand("selectAll");
            document.execCommand("Copy");
            // 等50毫秒，keyPress事件发生了再去处理数据
            setTimeout(function () {
                $("#luckysheet-copy-content").blur();
            }, 10);
        }
        else {
            clipboardData.setData('Text', cpdata);
            return false;//否则设不生效
        }
    },
    pasteImgItem: function () {
        let _this = this;
        if (_this.images == null) {
            _this.images = {};
        }
        let rowIndex = Store.luckysheet_select_save[0].row_focus || 0;
        let colIndex = Store.luckysheet_select_save[0].column_focus || 0;
        _this._insertImg(_this.copyImgItemObj.src, rowIndex, colIndex);
    },
    //复制图片到指定行列
    pastImgToCell: function (sourceImgId, toRow, toCol, toCellId) {
        var src = this.images[sourceImgId].src;
        this._insertImg(src, toRow, toCol, null, toCellId);
    },
    allImagesShow: function () {
        let _this = this;

        $("#luckysheet-modal-dialog-activeImage").hide();
        $("#luckysheet-modal-dialog-cropping").hide();
        $("#luckysheet-modal-dialog-slider-imageCtrl").hide();
        $("#luckysheet-image-showBoxs .img-list").empty();

        if (_this.images == null) {
            return;
        }

        for (let imgId in _this.images) {
            let imgItem = _this.images[imgId];
            let modelHtml = _this.modelHtml(imgId, imgItem);
            $("#luckysheet-image-showBoxs .img-list").append(modelHtml);
        }
    },
    moveChangeSize: function (rc, index, size) {
        let _this = this;
        let images = $.extend(true, {}, _this.images);

        if (rc == "row") {
            let row = Store.visibledatarow[index],
                row_pre = index - 1 == -1 ? 0 : Store.visibledatarow[index - 1];
            let changeSize = size - (row - row_pre - 1);

            for (let imgId in images) {
                let imgItem = images[imgId];
                let imgItemParam = _this.getImgItemParam(imgItem);
                let type = imgItem.type;

                if (type == "1") {
                    if (imgItemParam.top >= row) {
                        imgItem.default.top = imgItemParam.top + changeSize - imgItem.crop.offsetTop;
                    }
                    else {
                        if (imgItemParam.top + imgItemParam.height >= row - 2) {
                            if (imgItemParam.top < row + changeSize) {
                                let scaleY = (imgItemParam.height + changeSize) / imgItemParam.height;
                                imgItem.default.height = Math.round(imgItem.default.height * scaleY);
                                imgItem.crop.height = Math.round(imgItem.crop.height * scaleY);
                                imgItem.crop.offsetTop = Math.round(imgItem.crop.offsetTop * scaleY);
                            }
                            else {
                                let scaleY = (imgItemParam.top + imgItemParam.height - row) / imgItemParam.height;
                                imgItem.default.height = Math.round(imgItem.default.height * scaleY);
                                imgItem.crop.height = Math.round(imgItem.crop.height * scaleY);
                                imgItem.crop.offsetTop = Math.round(imgItem.crop.offsetTop * scaleY);
                                imgItem.default.top = row + changeSize - imgItem.crop.offsetTop;
                            }
                        }
                        else {
                            if (imgItemParam.top > row + changeSize) {
                                let scaleY = 1 / imgItemParam.height;
                                imgItem.default.height = Math.round(imgItem.default.height * scaleY);
                                imgItem.crop.height = Math.round(imgItem.crop.height * scaleY);
                                imgItem.crop.offsetTop = Math.round(imgItem.crop.offsetTop * scaleY);
                                imgItem.default.top = row + changeSize - imgItem.crop.offsetTop;
                            }
                            else if (imgItemParam.top + imgItemParam.height > row + changeSize) {
                                let scaleY = (row + changeSize - imgItemParam.top) / imgItemParam.height;
                                imgItem.default.height = Math.round(imgItem.default.height * scaleY);
                                imgItem.crop.height = Math.round(imgItem.crop.height * scaleY);
                                imgItem.crop.offsetTop = Math.round(imgItem.crop.offsetTop * scaleY);
                            }
                        }
                    }
                }
                else if (type == "2") {
                    if (imgItemParam.top >= row) {
                        imgItem.default.top = imgItemParam.top + changeSize - imgItem.crop.offsetTop;
                    }
                    else if (imgItemParam.top > row + changeSize) {
                        imgItem.default.top = row + changeSize - imgItem.crop.offsetTop;
                    }
                }
            }
        }
        else if (rc == "column") {
            let col = Store.visibledatacolumn[index],
                col_pre = index - 1 == -1 ? 0 : Store.visibledatacolumn[index - 1];
            let changeSize = size - (col - col_pre - 1);

            for (let imgId in images) {
                let imgItem = images[imgId];
                let imgItemParam = _this.getImgItemParam(imgItem);
                let type = imgItem.type;

                if (type == "1") {
                    if (imgItemParam.left >= col) {
                        imgItem.default.left = imgItemParam.left + changeSize - imgItem.crop.offsetLeft;
                    }
                    else {
                        if (imgItemParam.left + imgItemParam.width >= col - 2) {
                            if (imgItemParam.left < col + changeSize) {
                                let scaleX = (imgItemParam.width + changeSize) / imgItemParam.width;
                                imgItem.default.width = Math.round(imgItem.default.width * scaleX);
                                imgItem.crop.width = Math.round(imgItem.crop.width * scaleX);
                                imgItem.crop.offsetLeft = Math.round(imgItem.crop.offsetLeft * scaleX);
                            }
                            else {
                                let scaleX = (imgItemParam.left + imgItemParam.width - col) / imgItemParam.width;
                                imgItem.default.width = Math.round(imgItem.default.width * scaleX);
                                imgItem.crop.width = Math.round(imgItem.crop.width * scaleX);
                                imgItem.crop.offsetLeft = Math.round(imgItem.crop.offsetLeft * scaleX);
                                imgItem.default.left = col + changeSize - imgItem.crop.offsetLeft;
                            }
                        }
                        else {
                            if (imgItemParam.left > col + changeSize) {
                                let scaleX = 1 / imgItemParam.width;
                                imgItem.default.width = Math.round(imgItem.default.width * scaleX);
                                imgItem.crop.width = Math.round(imgItem.crop.width * scaleX);
                                imgItem.crop.offsetLeft = Math.round(imgItem.crop.offsetLeft * scaleX);
                                imgItem.default.left = col + changeSize - imgItem.crop.offsetLeft;
                            }
                            else if (imgItemParam.left + imgItemParam.width > col + changeSize) {
                                let scaleX = (col + changeSize - imgItemParam.left) / imgItemParam.width;
                                imgItem.default.width = Math.round(imgItem.default.width * scaleX);
                                imgItem.crop.width = Math.round(imgItem.crop.width * scaleX);
                                imgItem.crop.offsetLeft = Math.round(imgItem.crop.offsetLeft * scaleX);
                            }
                        }
                    }
                }
                else if (type == "2") {
                    if (imgItemParam.left >= col) {
                        imgItem.default.left = imgItemParam.left + changeSize - imgItem.crop.offsetLeft;
                    }
                    else if (imgItemParam.left > col + changeSize) {
                        imgItem.default.left = col + changeSize - imgItem.crop.offsetLeft;
                    }
                }
            }
        }

        return images;
    },
    ref: function () {
        let _this = this;

        let file = Store.luckysheetfile[getSheetIndex(Store.currentSheetIndex)];
        let images = _this.images;

        if (Store.clearjfundo) {
            Store.jfundo.length = 0;

            Store.jfredo.push({
                "type": "imageCtrl",
                "sheetIndex": Store.currentSheetIndex,
                "images": file.images == null ? null : $.extend(true, {}, file.images),
                "curImages": images
            });
        }

        file.images = $.extend(true, {}, images);
        server.saveParam("all", Store.currentSheetIndex, file.images, { "k": "images" });
    },
    // 刷新图片位置
    refreshPosition: function () {
        let _this = this;
        $("#luckysheet-image-showBoxs .img-list div").each(function (i, imgItem) {
            var cellId = $(imgItem).attr("cellid");//单元格id
            var imgId = $(imgItem).attr("id");//图片id            
            console.log('cellId：' + cellId);
            var cellPosition = findIndexById(Store.flowdata, cellId);//单元格所在行列位置
            if (cellPosition) {
                let left = cellPosition.col == 0 ? 0 : Store.visibledatacolumn[cellPosition.col - 1];
                let top = cellPosition.row == 0 ? 0 : Store.visibledatarow[cellPosition.row - 1];
                $(imgItem).css({ "left": `${left}px`, "top": `${top}px` });//设置图片位置
                let item = _this.images[imgId];
                var zoomRatio = Store.zoomRatio;
                if (item.isFixedPos) {
                    item.fixedLeft = left / zoomRatio;
                    item.fixedTop = top / zoomRatio;
                }
                else {
                    item.default.left = left / zoomRatio;
                    item.default.top = top / zoomRatio;
                }
                _this.ref();
            }
        })
    }

}

export default imageCtrl;