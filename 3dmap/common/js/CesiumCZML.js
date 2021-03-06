/**====================================================================== [轨迹回放] ======================================================================================= */
/************************************************* CesiumSatellite start  ***************************************************** */

/***
 * @nanme 卫星扫描
 * @entity 扫描物实体
 * @satellite 卫星实体
 * 
 * @author zhangti
 * @version v1
 */
var CesiumSatellite = (function(){
    var viewer,_cesiumRadar,entitys = [],handler,tableparam;
	function _(){}
	
	_.init = function(param,flag){
		if(null === param || undefined === param)return;
		var t = this;
		for(var key in param){
			t[key] = param[key];
        }
        this.config();
        if(flag)this.build({popParam:['name',['cylinder','slices'],['cylinder','length'],['cylinder','topRadius']]});
    }
    
	_.config = function(){
        var _self = this;
        _self.createtoolbar();
        var viewModel = {
            entitySlices: _self.entitySlices,
            entityColor: 10,
            RadarRPC: _self.RadarRPC
        };
        Cesium.knockout.track(viewModel);
        var toolbar = document.getElementById('toolbar');
        Cesium.knockout.applyBindings(viewModel, toolbar);
    
        var  subscribeParameter = function(name) {
            Cesium.knockout.getObservable(viewModel, name).subscribe(
                function(newValue) {
                    _self.controller({key:name,value:newValue});
                }
            );
        }
        subscribeParameter('entitySlices');
        subscribeParameter('entityColor');
        subscribeParameter('RadarRPC');
	}
	
	_.build = function(param){
        var t =this;
        viewer = this.viewer,this.popParam = param.popParam;
		try {
            switch(t.handleType){
                case "":{ break; }
                default :{  t.createSatellite(); }
            }
        } catch (error) {
            console.log("error mannager:" + error);
        }
    }
    _.createSatellite = function(){
        var t = this;
        viewer.dataSources.add(Cesium.CzmlDataSource.load(t.sources)).then(function(dataSource) { //czml文件
               try{
                    t.satellite = dataSource;

                    t.createRadar();
                    
                    t.scan();

                    t.click();

                    viewer.camera.flyTo({destination: Cesium.Cartesian3.fromDegrees(117, 30,20000000)});
               }catch(e){
                    console.log(e);
               }
               
        });
    }
    _.createRadar = function(){ //创建地面雷达
        CesiumRadar1.init({
            viewer : this.viewer,
            pixelRange:15,
            minimumClusterSize:3,
            enabled:false,
            showtoolbar:false
        });
        CesiumRadar1.build({
            handleType : "def",
            kml:'../../../3dmap/Apps/SampleData/kml/facilities/facilities.kml'
        });   
    }
    _.createEntity = function(height){ //创建扫描物
        var _self = this;
        var param = {
            length: Math.max.apply(null,height),
            slices:_self.entitySlices,
            material:_self.entityColor
        }
        entity = new _cesiumTool({viewer:this.viewer}).createEntity({handleType:"cylinder",p:param});
        return entity;
    }
     /**
     * CZML是一种JSON格式的字符串，用于描述与时间有关的动画场景，
     * CZML包含点、线、地标、模型、和其他的一些图形元素，并指明了这些元素如何随时间而变化。
     * 某种程度上说, Cesium 和 CZML的关系就像 Google Earth 和 KML。
     * 
     * 其中如动图所示，扫描的样式是用cylinder做的，这个后续会再完善成波纹形状；
     * 主要还是运用了sampleproperty，将卫星运动的time和position也绑定到cylinder上，
     * 并且将cylinder的高度修改为卫星的一半；
     * @property 动态物
    */
    _.scan = function(){  //绑定卫星
        if(this.satellite == undefined)return;
        var dataSource = this.satellite,ids = this.ids;
        for(var i in ids){
            var satellite = dataSource.entities.getById(ids[i]);
            var positions = satellite.position.getValue(viewer.clock.currentTime);
            var scan_p = getPoint(positions);
            new createPoint(scan_p,satellite);
        }
    }
	_.controller = function(obj){
        if(obj == null) return;
        var key = obj.key,value = parseInt(obj.value);
        var change = function(geom,property,value){
            for(var i in entitys){
                entitys[i][geom][property] = value; 
            }
        }
        if("entitySlices" == key)change("cylinder","slices",value);
        if("entityColor" == key)change("cylinder","material",/*new Cesium.GridMaterialProperty({
                        color :getColor(value),
                        cellAlpha : 0.2,
                        lineCount : new Cesium.Cartesian2(8, 8),
                        lineThickness : new Cesium.Cartesian2(2.0, 2.0)
                      })*/getColor(value).withAlpha(0.3));
        if("RadarRPC" == key)CesiumRadar1.setPixelRange(value);
    }
    _.click = function(){
        handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas),_self = this;
        handler.setInputAction(function(movement) {
            try {
                var pickedLabel = viewer.scene.pick(movement.position);
                if (Cesium.defined(pickedLabel)) {
                    var featrue = pickedLabel.id;
                    if(featrue == null) return;
                    _PopController.init({
                        featrue:featrue,
                        paramArr:_self.popParam, //build传的参数
                        x:movement.position.x,
                        y:movement.position.y
                    });
                    _PopController.show()
                }
            } catch (error) {
                console.log(error);
            }
           
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    }
    _.show = function(node){
        var t = this,name = $(node).attr("value");
        if("satellite" == name){
            t[name].show = !t[name].show;
        }else if("radar" == name){
            CesiumRadar1._raderData.show = !CesiumRadar1._raderData.show;
        }else if("entity"){
        for(var i in entitys){
            entitys[i].show = !entitys[i].show;
        }
        }
    }

    _.remove = function(){
        var t = this;
        if(handler != null){
            handler.destroy();
            handler = null;
            t.satellite.show = false;
            _cesiumRadar._raderData.show = false;
        }
        if(entitys == 0){
            for(var i in entitys){
                viewer.entities.removeById(entitys[i].id)
            }
        }
    }
    _.createScan = function(length,lon,lat){
             //var length = 400000.0;
            // 1.2 地面位置(垂直地面)
            var positionOnEllipsoid = Cesium.Cartesian3.fromDegrees(lon, lat);
            // 1.3 中心位置
            var centerOnEllipsoid = Cesium.Cartesian3.fromDegrees(lon, lat, length*0.5);
            // 1.4 顶部位置(卫星位置)
            var topOnEllipsoid = Cesium.Cartesian3.fromDegrees(lon, lat, length);
            // 1.5 矩阵计算
            var modelMatrix = Cesium.Matrix4.multiplyByTranslation(
                Cesium.Transforms.eastNorthUpToFixedFrame(positionOnEllipsoid),
                new Cesium.Cartesian3(0.0, 0.0, length * 0.5), new Cesium.Matrix4()
            );
            // 4 创建雷达放射波
            // 4.1 先创建Geometry
            var cylinderGeometry = new Cesium.CylinderGeometry({
                length: length,
                topRadius: 0.0,
                bottomRadius: length * 0.5,
                //vertexFormat : Cesium.PerInstanceColorAppearance.VERTEX_FORMAT
                vertexFormat: Cesium.MaterialAppearance.MaterialSupport.TEXTURED.vertexFormat
            });
            // 4.2 创建GeometryInstance
            var redCone = new Cesium.GeometryInstance({
                geometry: cylinderGeometry,
                modelMatrix:  modelMatrix,
                // attributes : {
                //     color : Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.RED)
                // }
            });
            // 4.3 创建Primitive
            var radar = viewer.scene.primitives.add(new Cesium.Primitive({
                geometryInstances: [redCone],
                // appearance : new Cesium.PerInstanceColorAppearance({
                //     closed : true,
                //     translucent: false
                // })
                appearance: new Cesium.MaterialAppearance({
                    // 贴图像纹理
                    // material: Cesium.Material.fromType('Image', {
                    //     image: '../../SampleData/models/CesiumBalloon/CesiumBalloonPrint_singleDot.png'
                    // }),

                    // 贴棋盘纹理
                    // material: Cesium.Material.fromType('Checkerboard'),

                    // 自定义纹理
                    material: new Cesium.Material({
                        fabric: {
                            type: 'VtxfShader1',
                            uniforms: {
                                color: new Cesium.Color(0.2, 1.0, 0.0, 1.0),
                                repeat: 30.0,
                                offset: 0.0,
                                thickness: 0.3,
                            },
                            source: `
                                uniform vec4 color;
                                uniform float repeat;
                                uniform float offset;
                                uniform float thickness;

                                czm_material czm_getMaterial(czm_materialInput materialInput)
                                {
                                    czm_material material = czm_getDefaultMaterial(materialInput);
                                    float sp = 1.0/repeat;
                                    vec2 st = materialInput.st;
                                    float dis = distance(st, vec2(0.5));
                                    float m = mod(dis + offset, sp);
                                    float a = step(sp*(1.0-thickness), m);

                                    material.diffuse = color.rgb;
                                    material.alpha = a * color.a;

                                    return material;
                                }
                            `
                        },
                        translucent: false
                    }),
                    faceForward : false, // 当绘制的三角面片法向不能朝向视点时，自动翻转法向，从而避免法向计算后发黑等问题
                    closed: true // 是否为封闭体，实际上执行的是是否进行背面裁剪
                }),
            }));

            // 5 动态修改雷达材质中的offset变量，从而实现动态效果。
            viewer.scene.preUpdate.addEventListener(function() {
                var offset = radar.appearance.material.uniforms.offset;
                offset -= 0.001;
                if (offset > 1.0) {
                    offset = 0.0;
                }
                radar.appearance.material.uniforms.offset = offset;
            })

            return radar;
    }

    _.initSelect = function(){ //创建默认初始化数据
        tableparam = [	
            {id:"_ids1",type:"select",key:"ids",value:["Satellite/ISS","Satellite/Geoeye1"],code:["Satellite/ISS","Satellite/Geoeye1"]},
            {id:"_ids2",type:"select",key:"type",value:["czml"],code:["czml"]},
            {id:"_ids3",type:"select",key:"sources",value:["../../../3dmap/Apps/SampleData/simple.czml"],code:["../../../3dmap/Apps/SampleData/simple.czml"]},
            {id:"_ids4",type:"text",key:"timeNum",value:288,code:"timeNum"},
            {id:"_ids5",type:"text",key:"entity",value:"圆锥",code:"entity"},
            {id:"_ids6",type:"text",key:"entitySlices",value:4,code:"entitySlices"},
            {id:"_ids7",type:"text",key:"entityColor",value:23,code:"entityColor"},
            {id:"_ids8",type:"text",key:"RadarRPC",value:10,code:"RadarRPC"}
        ]
        var table = createTable(tableparam);
        $("#content").empty().append(table);
        $("#content select,input").css("width","200px");
    }

    _.select = function(viewer){ //点击查询初始化的数据
       if(tableparam.length == 0)return;
       var selectData = [];
       for(var i in tableparam){
           var val = $('#_ids'+(parseInt(i)+1)).val();
           selectData.push({id:'_ids'+(parseInt(i)+1),code:tableparam[i].key,value:val});
       }
       var initData = {
            viewer:viewer,
            ids:[selectData[0].value],
            handType:selectData[1].value,
            sources:selectData[2].value, 
            timeNum:parseInt(selectData[3].value),
            entity : selectData[4].value,
            entitySlices:parseInt(selectData[5].value),
            entityColor:getColor(selectData[6].value),
            RadarRPC:parseInt(selectData[7].value)
       }
       
       return initData;

    }
    _.createtoolbar = function (){
        var toolbarparam = [	
            {type:"range",key:"entitySlices",value:4,min:"1",max:"20",step:"1"},
            {type:"range",key:"entityColor",value:10,min:"0",max:"147",step:"1"},
            {type:"range",key:"RadarRPC",value:10,min:"2",max:"20",step:"1"}   
        ]
        var table = createToolbar(toolbarparam);
        var toolbar = 
        '<div id="toolbar">'+
         table +
         '<button type="button" class="cesium-button" onclick="CesiumSatellite.show(this);" value="satellite">卫星</button>'+
         '<button type="button" class="cesium-button" onclick="CesiumSatellite.show(this);" value="radar">雷达</button>'+
         '<button type="button" class="cesium-button" onclick="CesiumSatellite.show(this);" value="entity">扫描物</button>'+
        '</div>';
        $("#toolbar").remove();
        $("body").append(toolbar);
        $("#toolbar").css("background","rgba(42, 42, 42, 0.8)").css("padding","4px;").css("border-radius", "4px");
        $("#toolbar input").css("vertical-align","middle").css("padding-top","2px").css("padding-bottom","2px");
    }
	var getPoint = function(positions){
        var cartographic = viewer.scene.globe.ellipsoid.cartesianToCartographic(positions);
        var lat = Cesium.Math.toDegrees(cartographic.latitude),
                    lng = Cesium.Math.toDegrees(cartographic.longitude),
                    hei = parseFloat(cartographic.height/4);
        return Cesium.Cartesian3.fromDegrees(lng, lat,0);
    }
    var createPoint = (function(){
        function _(positions,satellite){
            this.options = {
                 cylinder: {
                    HeightReference: Cesium.HeightReference.RELATIVE_TO_GROUND, //表示相对于地形的位置。
                    length:600000,     //长度
                    topRadius:0,    //顶点半径
                    bottomRadius:600000 / 2,  //底部半径
                    material:new Cesium.Color(0, 1, 1, .4),
                    slices:4
                }
            }
            this.positions = positions;
            this.satellite = satellite;
            this._init();
        }
        _.prototype._init = function(){
            var _self = this;
            var _update = function(){
                var positions = _self.satellite.position.getValue(viewer.clock.currentTime);
                return scan_p = getPoint(positions);
            };
            var _length = function(){
                var positions = _self.satellite.position.getValue(viewer.clock.currentTime);
                var cartographic = viewer.scene.globe.ellipsoid.cartesianToCartographic(positions);
                return cartographic.height * 2;
            }
            this.options.position = new Cesium.CallbackProperty(_update,false);
            this.options.cylinder.length = new Cesium.CallbackProperty(_length,false);
            entitys.push(viewer.entities.add(this.options));
        };
        return _;
    })();

    return _;
})();


/************************************************* CesiumSatellite end  ***************************************************** */
/************************************************* newFlyPath start    ***************************************************** */
 /***
 * 飞行路径
 *  new
 */
var newFlyPath = (function(){
    var dsArr,viewer;
    var colorRgba = [[255,0,0,255],[255,100,97,255],[238,153,34,255],[255,100,97,255],[238,153,34,255],[238,153,34,255],[238,153,34,255],[238,153,34,255],[238,153,34,255],[238,153,34,255]]
    function _(){}
    
    _.init = function(param,flag){
        if(null === param || undefined === param)return;
        var t = this;
        for(var key in param){
            t[key] = param[key];
        }
        viewer = this.viewer;
        if(flag)this.create();
    }

    _.initSelect = function(){ //创建默认初始化数据
        tableparam	 = [
            {id:"_ids1",type:"select",key:"type",value:["json"],code:["json"]},
            {id:"_ids2",type:"select",key:"sources",value:["../../../3dmap/common/data/newFlyPath.json"],code:["../../../3dmap/common/data/newFlyPath.json"]},
            {id:"_ids3",type:"select",key:"image",value:["../../../3dmap/common/css/plane.png"],code:["../../../3dmap/common/css/plane.png"]},
            {id:"_ids4",type:"text",key:"lon",value:114.302312702,code:"lon"},
            {id:"_ids5",type:"text",key:"lat",value:30.598026044,code:"lat"},
            {id:"_ids6",type:"text",key:"height",value:50000,code:"height"},
            {id:"_ids7",type:"text",key:"lineColor",value:5,code:"lineColor"},
            {id:"_ids8",type:"text",key:"multiplier",value:100,code:"multiplier"}
        ]
        var table = createTable(tableparam);
        $("#content").empty().append(table);
        $("#content select,input").css("width","200px");
    }

    _.select = function(viewer){ //点击查询初始化的数据
       if(tableparam.length == 0)return;
       var selectData = [];
       for(var i in tableparam){
           var val = $('#_ids'+(parseInt(i)+1)).val();
           selectData.push({id:'_ids'+(parseInt(i)+1),code:tableparam[i].key,value:val});
       }
       var initData = {
            viewer:viewer,
            type:[selectData[0].value],
            sources:selectData[1].value,
            image:selectData[2].value, 
            lon:parseInt(selectData[3].value),
            lat : parseInt(selectData[4].value),
            height:parseInt(selectData[5].value),
            lineColor:parseInt(selectData[6].value),
            multiplier:parseInt(selectData[7].value)
       }
       
       return initData;

    }
    _.create = function(){
        var t = this;
         $.get(this.sources,{},function(points){
                if(points == "" && points == null)return;
                var data={
                    image:t.image, //如果有其他需求 就直接修改ysc内部代码吧 这边就简单写几个参数
                    center:{lon:t.lon,lat:t.lat},
                    points:points,
                    height:t.height,//抛物线的最高点
                    multiplier:t.multiplier,//动画的运行时间加快倍数//速度
                    lineColor:colorRgba[t.lineColor] //线的颜色 最后一个255就相当于1
                };
                dsArr = _cesium.creatFlyLinesByCzml(viewer,data); // shouldAnimate : true,//允许动画 //这个得必须有！！
                viewer.camera.setView({
                    destination : Cesium.Cartesian3.fromDegrees(t.lon,t.lat,t.height)
                });
         }); 
           setTimeout(function () {
               for(var i=0;i< dsArr.length;i++){ //这是一个bug?textarea中不能有x<后面不能加英文字符串 如果要加则要有空格
                   viewer.dataSources.remove(dsArr[i]);
               }
           },1000*60);//60秒后清除    
    }

    _.remove = function(){
        if(viewer == null) return;
        for(var i=0;i< dsArr.length;i++){ //这是一个bug?textarea中不能有x<后面不能加英文字符串 如果要加则要有空格
            viewer.dataSources.remove(dsArr[i]);
        }
    }
    return _;
})();

 /************************************************* newFlyPath end    ***************************************************** */
 /************************************************* CesiumWind start    ***************************************************** */
 /***
 * 风场绘制
 *
 * @Particle 高能粒子
 * @WindField 风场网格
 * @Wind 风场粒子
 * 
 * @author zhangti
 * @version v1
 */
var CesiumWind = (function(){
    var viewer = null;
    function _(){};

    _.init = function(param,flag){
        if(param == "" && param == null)return;


        viewer = param.viewer;
        if(flag)this.build(param);
    }

    _.config = function(param){
        //定时任务
        var cw = this;
        if(param.flag){
            cw.timer = setInterval(function () {
                cw.windy.animate();
            }, param.ms);
        }  
    }

    _.build = function(param){
        if(param == "" && param == null)return;
        var cw = this;
        $.get(param.sources,{},function(json){

            if(json == "" && json == null)return;
            param.data = json;
            cw.windy = new Windy(param,param.viewer);
            cw.windy.animate();
            CesiumWind.config(param);

            CesiumWind.initController();

            viewer.camera.flyTo({destination: Cesium.Cartesian3.fromDegrees(117, 30,20000000)});
        }); 
    }
    _.initController = function (){
        var _self = this;
        _self.createToolbar();
        var subscribeParameter = function(name) {
            Cesium.knockout.getObservable(viewModel, name).subscribe(
                function(newValue) {
                    _self.controller({key:name,value:newValue});
                }
            );
        }
        var viewModel = {
            color: 10,
            SPEED_RATE: 0.15        
        };
        Cesium.knockout.track(viewModel);
        var toolbar = document.getElementById('toolbar');
        Cesium.knockout.applyBindings(viewModel, toolbar);
        subscribeParameter('color');
        subscribeParameter('SPEED_RATE');
    }
    //外部控制节点
    _.controller = function (obj){
        if(obj === null & obj === "")return;
        var key = obj.key,value = parseInt(obj.value);
        if("color" == key)this.windy.color = getColor(value);
        if("SPEED_RATE" == key)this.windy.SPEED_RATE = value;
        
    }
    _.createToolbar = function(){
        var toolbarparam	 = [	
            {type:"range",key:"color",value:4,min:"0",max:"147",step:"10"},
            {type:"range",key:"SPEED_RATE",value:4,min:"0",max:"2",step:"0.1"}
        ]
        var table = createToolbar(toolbarparam);
        var toolbar = 
        '<div id="toolbar">'+
        table +
        '<button type="button" class="cesium-button" onclick="CesiumWind.remove();" value="satellite">清除</button>'+
        '<div></div>';
        $("#toolbar").remove();
        $("body").append(toolbar);
        $("#toolbar").css("background","rgba(42, 42, 42, 0.8)").css("padding","4px;").css("border-radius", "4px");
        $("#toolbar input").css("vertical-align","middle").css("padding-top","2px").css("padding-bottom","2px");
    }
    _.initSelect = function(){ //创建默认初始化数据
        tableparam	 = [
            {id:"_ids1",type:"select",key:"type",value:["json"],code:["json"]},
            {id:"_ids2",type:"select",key:"sources",value:["../../../3dmap/common/data/wind/2017121300.json","../../../3dmap/common/data/wind/current-wind-surface-level-gfs-1.0.json"],code:["../../../3dmap/common/data/wind/2017121300.json","../../../3dmap/common/data/wind/current-wind-surface-level-gfs-1.0.json"]},
            {id:"_ids3",type:"text",key:"SPEED_RATE",value:0.15,code:"SPEED_RATE"},
            {id:"_ids4",type:"text",key:"PARTICLES_NUMBER",value:2000,code:"PARTICLES_NUMBER"},
            {id:"_ids5",type:"text",key:"MAX_AGE",value:10,code:"MAX_AGE"},
            {id:"_ids6",type:"text",key:"BRIGHTEN",value:1.5,code:"BRIGHTEN"},
            {id:"_ids7",type:"text",key:"color",value:10,code:"color"},
            {id:"_ids8",type:"text",key:"ms",value:300,code:"ms"}
        ]
        var table = createTable(tableparam);
        $("#content").empty().append(table);
        $("#content select,input").css("width","200px");
    }
    _.select = function(viewer){ //点击查询初始化的数据
       if(tableparam.length == 0)return;
       var selectData = [];
       for(var i in tableparam){
           var val = $('#_ids'+(parseInt(i)+1)).val();
           selectData.push({id:'_ids'+(parseInt(i)+1),code:tableparam[i].key,value:val});
       }
       var initData = {
            viewer:viewer,
            flag : true,
            type:[selectData[0].value],
            sources:selectData[1].value,
            SPEED_RATE:selectData[2].value, 
            PARTICLES_NUMBER:parseInt(selectData[3].value),
            MAX_AGE : parseInt(selectData[4].value),
            BRIGHTEN:parseInt(selectData[5].value),
            color:getColor(selectData[6].value),
            ms:parseInt(selectData[7].value)
       }
       
       return initData;
    }
    _.remove = function(){
        if(viewer != null){
            var cw = this;
            cw.windy.removeLines();
            window.clearInterval(cw.timer);   
        }
    }
    return _;
})();

var Particle = function () {
    this.x = null;
    this.dx = null;
    this.dx = null;
    this.y = null;
    this.age = null;
    this.birthAge = null;
    this.path = null;
};


//define([],function () {

var WindField = function (obj) {
    this.west = null;
    this.east = null;
    this.south = null;
    this.north = null;
    this.rows = null;
    this.cols = null;
    this.dx = null;
    this.dy = null;
    this.unit = null;
    this.date = null;

    this.grid = null;
    this._init(obj);
};

WindField.prototype = {
    constructor: WindField,
    _init: function (obj) {
        var header = obj.header,
            uComponent = obj['uComponent'],
            vComponent = obj['vComponent'];

        this.west = +header['lo1'];
        this.east = +header['lo2'];
        this.south = +header['la2'];
        this.north = +header['la1'];
        this.rows = +header['ny'];
        this.cols = +header['nx'];
        this.dx = +header['dx'];
        this.dy = +header['dy'];
        this.unit = header['parameterUnit'];
        this.date = header['refTime'];

        this.grid = [];
        var k = 0,
            rows = null,
            uv = null;
        for (var j = 0; j < this.rows; j++) {
            rows = [];
            for (var i = 0; i < this.cols; i++, k++) {
                uv = this._calcUV(uComponent[k], vComponent[k]);
                rows.push(uv);
            }
            this.grid.push(rows);
        }
    },
    _calcUV: function (u, v) {
        return [+u, +v, Math.sqrt(u * u + v * v)];
    },
    _bilinearInterpolation: function (x, y, g00, g10, g01, g11) {
        var rx = (1 - x);
        var ry = (1 - y);
        var a = rx * ry, b = x * ry, c = rx * y, d = x * y;
        var u = g00[0] * a + g10[0] * b + g01[0] * c + g11[0] * d;
        var v = g00[1] * a + g10[1] * b + g01[1] * c + g11[1] * d;
        return this._calcUV(u, v);
    },
    getIn: function (x, y) {
        var x0 = Math.floor(x),
            y0 = Math.floor(y),
            x1, y1;
        if (x0 === x && y0 === y) return this.grid[y][x];

        x1 = x0 + 1;
        y1 = y0 + 1;

        var g00 = this.getIn(x0, y0),
            g10 = this.getIn(x1, y0),
            g01 = this.getIn(x0, y1),
            g11 = this.getIn(x1, y1);
        return this._bilinearInterpolation(x - x0, y - y0, g00, g10, g01, g11);
    },
    isInBound: function (x, y) {
        if ((x >= 0 && x < this.cols - 2) && (y >= 0 && y < this.rows - 2)) return true;
        return false;
    }
};


var Windy = function (param, cesiumViewer) {
    if(null === param || undefined === param)return;
    var t = this;
    for(var key in param){
        t[key] = param[key];
    }
    this.windData = param.data;
    this.windField = null;
    this.particles = [];
    this.lines = null;
    _primitives = cesiumViewer.scene.primitives;
    this._init();
};
Windy.prototype = {
    constructor: Windy,
    _init: function () {
        // 创建风场网格
        this.windField = this.createField();
        // 创建风场粒子
        for (var i = 0; i < this.PARTICLES_NUMBER; i++) {
            this.particles.push(this.randomParticle(new Particle()));
        }
    },
    createField: function () {
        var data = this._parseWindJson();
        return new WindField(data);
    },
    animate: function () {
        var self = this,
            field = self.windField,
            particles = self.particles;
            SPEED_RATE = self.SPEED_RATE,
            _color = self.color;
        var instances = [],
            nextX = null,
            nextY = null,
            xy = null,
            uv = null;
        particles.forEach(function (particle) {
            if (particle.age <= 0) {
                self.randomParticle(particle);
            }
            if (particle.age > 0) {
                var x = particle.x,
                    y = particle.y;

                if (!field.isInBound(x, y)) {
                    particle.age = 0;
                } else {
                    uv = field.getIn(x, y);
                    nextX = x +  SPEED_RATE * uv[0];
                    nextY = y +  SPEED_RATE * uv[1];
                    particle.path.push(nextX, nextY);
                    particle.x = nextX;
                    particle.y = nextY;
                    instances.push(self._createLineInstance(self._map(particle.path), particle.age / particle.birthAge));
                    particle.age--;
                }
            }
        });
        if (instances.length <= 0) this.removeLines();
        self._drawLines(instances);
    },
    _parseWindJson: function () {
        var uComponent = null,
            vComponent = null,
            header = null;
        this.windData.forEach(function (record) {
            var type = record.header.parameterCategory + "," + record.header.parameterNumber;
            switch (type) {
                case "2,2":
                    uComponent = record['data'];
                    header = record['header'];
                    break;
                case "2,3":
                    vComponent = record['data'];
                    break;
                default:
                    break;
            }
        });
        return {
            header: header,
            uComponent: uComponent,
            vComponent: vComponent
        };
    },
    removeLines: function () {
        if (this.lines) {
            _primitives.remove(this.lines);
            this.lines.destroy();
        }
    },
    //求路径上点
    _map: function (arr) {
        var length = arr.length,
            field = this.windField,
            dx = field.dx,
            dy = field.dy,
            west = field.west,
            south = field.north,
            newArr = [];
        for (var i = 0; i <= length - 2; i += 2) {
            newArr.push(
                west + arr[i] * dx,
                south - arr[i + 1] * dy
            )
        }
        return newArr;
    },
    //后边配色需要能配置
    _createLineInstance: function (positions, ageRate) {
        var colors = [],_color = this.color,
            length = positions.length,
            count = length / 2;
        for (var i = 0; i < length; i++) {
            colors.push(_color.withAlpha(i / count * ageRate * this.BRIGHTEN));
        }
        return new Cesium.GeometryInstance({
            geometry: new Cesium.PolylineGeometry({
                positions: Cesium.Cartesian3.fromDegreesArray(positions),
                colors: colors,
                width: 1.5,
                colorsPerVertex: true
            })
        });
    },
    _drawLines: function (lineInstances) {
        this.removeLines();
        var linePrimitive = new Cesium.Primitive({
            appearance: new Cesium.PolylineColorAppearance({
                translucent: true
            }),
            geometryInstances: lineInstances,
            asynchronous: false
        });
        this.lines = _primitives.add(linePrimitive);
    },
    randomParticle: function (particle) {
        var safe = 30,x, y;

        do {
            x = Math.floor(Math.random() * (this.windField.cols - 2));
            y = Math.floor(Math.random() * (this.windField.rows - 2));
        } while (this.windField.getIn(x, y)[2] <= 0 && safe++ < 30);

        particle.x = x;
        particle.y = y;
        particle.age = Math.round(Math.random() * this.MAX_AGE);//每一次生成都不一样
        particle.birthAge = particle.age;
        particle.path = [x, y];
        return particle;
    }
};
 /************************************************* CesiumWind end    ***************************************************** */