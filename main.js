define([
	"dojo/_base/declare",
	"framework/PluginBase",
	"esri/layers/VectorTileLayer",
	"esri/layers/ArcGISTiledMapServiceLayer",
	"esri/layers/ArcGISDynamicMapServiceLayer",
	"esri/layers/WMSLayer",
	"esri/layers/WMSLayerInfo",
	"esri/layers/FeatureLayer",
	"esri/geometry/Extent",
	"esri/SpatialReference",
	"esri/tasks/query",
	"esri/tasks/QueryTask",
	"esri/symbols/SimpleMarkerSymbol",
	"esri/symbols/SimpleFillSymbol",
	"esri/symbols/SimpleLineSymbol",
	"esri/Color",
	"esri/graphic",
    "dojo/dom",
    "dojo/text!./template.html",
	], function(declare,
		PluginBase,
		VectorTileLayer,
		ArcGISTiledMapServiceLayer,
		ArcGISDynamicMapServiceLayer,
		WMSLayer,
		WMSLayerInfo,
		FeatureLayer,
		Extent,
		SpatialReference,
		Query,
		QueryTask,
		SimpleMarkerSymbol,
		SimpleFillSymbol,
		SimpleLineSymbol,
		Color,
		Graphic,
		dom,
		template
	) {

		// TODO: Dashes, not underscores
		// TODO: http://dev.services.coastalresilience.org/arcgis/rest/services/Maine/Future_Habitat/MapServer/14/query?where=1%3D1&returnGeometry=false&orderByFields=NAME&f=pjson

		return declare(PluginBase, {
			toolbarName: 'Future Habitat',
			resizable: false,
			width: 425,
			size: 'custom',
			allowIdentifyWhenActive: false,
			layers: {},
			defaultExtent: new Extent(-7959275, 5087981, -7338606, 5791202, new SpatialReference({wkid: 102100})),

			initialize: function(frameworkParameters) {
				declare.safeMixin(this, frameworkParameters);
				this.$el = $(this.container);

				this.render();

				// Setup query handles
				this.qtParcels = new QueryTask('http://dev.services.coastalresilience.org/arcgis/rest/services/Maine/Future_Habitat/MapServer/1');
				this.qParcels = new Query();
				this.qParcels.returnGeometry = true;
				this.qParcels.outFields = ['*'];

				this.qtCrossings = new QueryTask('http://dev.services.coastalresilience.org/arcgis/rest/services/Maine/Future_Habitat/MapServer/0');
				this.qCrossings = new Query();
				this.qCrossings.returnGeometry = true;

				// Setup graphic styles
				
				this.regionSymbolHover = new SimpleFillSymbol(
					SimpleFillSymbol.STYLE_SOLID,
					new SimpleLineSymbol(
						SimpleLineSymbol.STYLE_SOLID,
						new Color([125,125,125,0.35]),
						1
					),
					new Color([80, 80, 80, 0.35])
				);

				this.selectedBarrierSymbol = new SimpleMarkerSymbol(
					SimpleMarkerSymbol.STYLE_CIRCLE,
					20,
				    new SimpleLineSymbol(
				    	SimpleLineSymbol.STYLE_SOLID,
				    	new Color([255,0,0]),
				    	1
				    ),
				    new Color([30,144,255, 1])
				);



				return this;
			},

			bindEvents: function() {
				var self = this;
				this.$el.find('.transparency-label').on('mousedown', function() {
					var control = $(this).parent('.transparency-control').toggleClass('open');
					if (control.hasClass('open')) {
						$('body').on('click.tranSlider', function(e) {
							if ($(e.target).parents('.transparency-control').length || $(e.target).hasClass('transparency-control')) {
								// Do nothing
							} else {
								control.removeClass('open');
								$('body').off('click.tranSlider');
							}
						});
					}
				});

				this.$el.find('.stat').on('click', function(e) {
					$('.stats .stat.active').removeClass('active');
					$(e.currentTarget).addClass('active');
				});

				this.$el.find('.layer input').on('change', function(e) {
					var checked = this.checked;
					var layer = $(e.target).parents('.layer');

					self.layers[$(this).data('layer')].setVisibility(checked);

					if (checked) {
						layer.find('.transparency-control').css('display', 'inline-block');
					} else {
						layer.find('.transparency-control').css('display', 'none');
					}
				});

				this.$el.find('#chosenRegion').on('change', function(e) {
					self.zoomToRegion(e.target.value);
				});
			},

			activate: function() {
				var self = this;

				// Only set the extent the first time the app is activated
				if (!this.initialized) {
					this.initialized = true;

					// TODO Use zoomtoregion function, but need to make sure data is loaded first
					this.map.setExtent(this.defaultExtent);
				}

				// NOTE Order added here is important because it is draw order on the map

				if (!this.layers.lidar) {
					this.layers.lidar = new WMSLayer("http://mapserver.maine.gov/wms/mapserv.exe?map=c:/wms/topos.map", {
						visible: false,
						visibleLayers: ['medem2_hill','medem2_overview10_hill','medem2_overview30_hill','medem2_overview100_hill']
					});
					this.map.addLayer(this.layers.lidar);
				}

				if (!this.layers.marshHabitat) {
					this.layers.marshHabitat = new ArcGISDynamicMapServiceLayer("http://dev.services.coastalresilience.org/arcgis/rest/services/Maine/Future_Habitat/MapServer", {
						id: 'marshHabitat'
					});
					this.layers.marshHabitat.setVisibleLayers([13]);
					this.map.addLayer(this.layers.marshHabitat);
				}

				if (!this.layers.non_tidal_wetlands) {
					this.layers.non_tidal_wetlands = new ArcGISDynamicMapServiceLayer("http://dev.services.coastalresilience.org/arcgis/rest/services/Maine/Future_Habitat/MapServer", {
						visible: false
					});
					this.layers.non_tidal_wetlands.setVisibleLayers([8]);
					this.map.addLayer(this.layers.non_tidal_wetlands);
				}

				if (!this.layers.wildlife_habitat) {
					this.layers.wildlife_habitat = new ArcGISDynamicMapServiceLayer("http://dev.services.coastalresilience.org/arcgis/rest/services/Maine/Future_Habitat/MapServer", {
						visible: false
					});
					this.layers.wildlife_habitat.setVisibleLayers([16]);
					this.map.addLayer(this.layers.wildlife_habitat);
				}

				if (!this.layers.road_stream_crossing) {
					this.layers.road_stream_crossing = new ArcGISDynamicMapServiceLayer("http://dev.services.coastalresilience.org/arcgis/rest/services/Maine/Future_Habitat/MapServer", {
						visible: false
					});
					this.layers.road_stream_crossing.setVisibleLayers([0]);
					this.map.addLayer(this.layers.road_stream_crossing);
				}

				if (!this.layers.parcels) {
					this.layers.parcels = new VectorTileLayer("http://tiles.arcgis.com/tiles/F7DSX1DSNSiWmOqh/arcgis/rest/services/Maine_Coastal_Parcels/VectorTileServer", {
						minScale: 288895.2771445
					});
					this.map.addLayer(this.layers.parcels);

					// TODO Clean this up when deactivated 
					this.parcelGraphics = new esri.layers.GraphicsLayer();
					this.map.addLayer(this.parcelGraphics);
				}

				if (!this.layers.regions) {
					// We use snapshot mode because we need all the features locally for querying attributes
					this.layers.regions = new FeatureLayer("http://dev.services.coastalresilience.org/arcgis/rest/services/Maine/Future_Habitat/MapServer/14", {
						mode: FeatureLayer.MODE_SNAPSHOT,
						outFields: ['*']
					});
					this.map.addLayer(this.layers.regions);
					
					this.layers.regions.on('mouse-over', function(e) {
						if (self.map.getZoom() < 10) {
							self.regionGraphics.clear();
							var highlightGraphic = new Graphic(e.graphic.geometry, self.regionSymbolHover);
							self.regionGraphics.add(highlightGraphic);
						}
						
					});

					// TODO Clean this up when deactivated 
					this.regionGraphics = new esri.layers.GraphicsLayer();
					this.map.addLayer(this.regionGraphics);
					this.regionGraphics.on('click', function(e) {
						if (self.map.getZoom() < 10) {
							self.map.setExtent(e.graphic.geometry.getExtent());
							self.regionGraphics.clear();
						}
					});

					// TODO: Clean this up when deactivated
					this.map.on('zoom-end', function(z) {
						if (z.level >= 10) {
							self.regionGraphics.clear();
						}
					});
				}

				this.map.on('click', function(e) {
					self.getParcelByPoint(e.mapPoint);
				});
			},

			deactivate: function() {

				_.each(Object.keys(this.layers), function(layer) {
					this.map.removeLayer(this.layers[layer]);
				}, this);

				// TODO: Cleanup map click events

				this.layers = {};
			},

			hibernate: function() {

			},

			render: function() {
				var self = this;
				this.$el.html(_.template(template, {

                }));

                this.$el.find('#chosenRegion').chosen({
                	disable_search_threshold: 20,
                	width: '100%'
                });

                var saltMarshLabels = [
                	'current',
                	'1&nbsp;ft',
                	'2&nbsp;ft',
                	'3.3&nbsp;ft',
                	'6&nbsp;ft'
                ];

                this.$el.find("#salt-marsh-slider").slider({
            		min: 0,
            		max: 4,
            		range: false,
            		change: function(e, ui) {
            			self.setMarshScenario(ui.value);
            		}
				}).slider('pips',  { 
					rest: 'label',
					labels: saltMarshLabels,

				});

                this.$el.find(".transparency-slider .slider").slider({
            		min: 0,
            		max: 100,
            		step: 1,
            		value: [100],
            		range: false,
            		slide: function(e, ui) {
            			var control = $(e.target).parents('.transparency-control');
             			var layer = control.first().data('layer');
						control.find('.value').html(ui.value + '%');
						self.layers[layer].setOpacity(ui.value / 100);
            		}
				});

				this.$el.find('.info').tooltip({container:'body'});

				this.bindEvents();
			},

			zoomToRegion: function(region) {
				var self = this;

				this.$el.find('.region-label').html(region);

				if (region === 'Maine') {
					this.map.setExtent(this.defaultExtent);
					self.$el.find('.current-salt-marsh .number .value').html(parseInt(_.reduce(this.layers.regions.graphics, function(mem, graphic) {
						return mem + graphic.attributes.Current_Tidal_Marsh_Acres;
					}, 0)));
					self.$el.find('.inland-wetlands .number .value').html(parseInt(_.reduce(this.layers.regions.graphics, function(mem, graphic) {
						return mem + graphic.attributes.Non_Tidal_Wetland_Acres;
					}, 0)));
					self.$el.find('.roadcrossing-potential .number .value').html(parseInt(_.reduce(this.layers.regions.graphics, function(mem, graphic) {
						return mem + graphic.attributes.Barrier_Count;
					}, 0)));
				} else {
					_.each(this.layers.regions.graphics, function(graphic) {
						if (graphic.attributes.NAME === region) {

							// TODO Select based off of current salt marsh scenario
							// TODO Add commas as thousands selector
							self.$el.find('.current-salt-marsh .number .value').html(parseInt(graphic.attributes.Current_Tidal_Marsh_Acres));
							self.$el.find('.inland-wetlands .number .value').html(parseInt(graphic.attributes.Non_Tidal_Wetland_Acres));
							self.$el.find('.roadcrossing-potential .number .value').html(parseInt(graphic.attributes.Barrier_Count));

							self.map.setExtent(graphic.geometry.getExtent());
							return false;
						}
					});

				}
			},

			setMarshScenario: function(idx) {
				// Map the slider index to the layer index in the map service
				var scenarioMap = {
					0: 13,
					1: 9,
					2: 10,
					3: 11,
					4: 12
				};

				this.layers.marshHabitat.setVisibleLayers([scenarioMap[idx]]);
				this.layers.marshHabitat.refresh();
			},

			getParcelByPoint: function(pt) {
				var self = this;
				this.qParcels.geometry = pt;
				this.qtParcels.execute(this.qParcels, function(results) {
					if (results.features.length) {
						var parcel = results.features[0];
						var crossings = parcel.attributes.Crossings_100m_List.split(',');

						console.log(crossings, parcel);
						self.$el.find('.parcel-label').show();
						self.$el.find('#parcel-id').html(parcel.attributes.Parcel_Name);
						self.$el.find('.region-label').html(parcel.attributes.Parcel_Name);

						self.$el.find('.current-salt-marsh .number .value').html(parseInt(parcel.attributes.Current_Tidal_Marsh_Acres));
						self.$el.find('.inland-wetlands .number .value').html(parseInt(parcel.attributes.Non_Tidal_Wetland_Acres));
						self.$el.find('.roadcrossing-potential .number .value').html(parseInt(parcel.attributes.Barrier_Count_100m));

						self.parcelGraphics.clear();
						var highlightGraphic = new Graphic(parcel.geometry, self.regionSymbolHover);
						self.parcelGraphics.add(highlightGraphic);

						// TODO Potential Race condition fix where clicking on a new parcel before this finishes loading
						self.qCrossings.where = "SiteID = '" + crossings.join("' OR SiteID = '") + "'";
						self.qtCrossings.execute(self.qCrossings, function(crossing_result) {
							console.log(crossing_result);

							_.each(crossing_result.features, function(feature) {
								var crossingGraphic = new Graphic(feature.geometry, self.selectedBarrierSymbol);
								self.parcelGraphics.add(crossingGraphic);
							})
						})



					} else {
						self.$el.find('.parcel-label').hide();
					}
					
				});
			}

		});

	}
);
