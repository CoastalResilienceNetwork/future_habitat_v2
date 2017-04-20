define([
	"dojo/_base/declare",
	"framework/PluginBase",
	"esri/layers/VectorTileLayer",
	"esri/layers/ArcGISTiledMapServiceLayer",
	"esri/layers/ArcGISDynamicMapServiceLayer",
	"esri/layers/WMSLayer",
	"esri/layers/WMSLayerInfo",
	"esri/layers/FeatureLayer",
	"esri/layers/ImageParameters",
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
		ImageParameters,
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
		// TODO: Clear currently selected parcel button

		return declare(PluginBase, {
			toolbarName: 'Future Habitat',
			resizable: false,
			width: 425,
			size: 'custom',
			allowIdentifyWhenActive: false,
			hasCustomPrint: true,
			usePrintPreviewMap: true,
			previewMapSize: [768, 500],
			layers: {},
			defaultExtent: new Extent(-7959275, 5087981, -7338606, 5791202, new SpatialReference({wkid: 102100})),
			selectedParcel: null,
			marshScenarioIdx: null,

			initialize: function(frameworkParameters) {
				declare.safeMixin(this, frameworkParameters);
				this.$el = $(this.container);

				this.render();
				this.printButton.hide();

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

				this.highlightParcelSymbol = new SimpleFillSymbol(
					SimpleFillSymbol.STYLE_SOLID,
					new SimpleLineSymbol(
						SimpleLineSymbol.STYLE_SOLID,
						new Color([125,125,125,0.5]),
						4
					),
					new Color([255, 255, 255, 0.0])
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

				this.$el.find('.export .print').on('click', function() {
					self.printButton.trigger('click');
				});

			},

			// TODO Set appropriate zoom levels for layers
			// TODO Clean up legend labels for selected features

			activate: function() {
				var self = this;

				// Only set the extent the first time the app is activated
				if (!this.initialized) {
					this.initialized = true;

					// TODO Use zoomtoregion function, but need to make sure data is loaded first
					// TODO Don't hard code initial values
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

				if (!this.layers.current_conservation_lands) {
					this.layers.current_conservation_lands = new ArcGISDynamicMapServiceLayer("http://cumulus-web-adapter-1827610810.us-west-1.elb.amazonaws.com/arcgis/rest/services/EasternDivision/SECUREDAREAS2014_S_A_Map_Service_2014_Public/MapServer", {
						visible: false
					});
					this.map.addLayer(this.layers.current_conservation_lands);
				}
				
				if (!this.layers.wildlife_habitat) {
					this.layers.wildlife_habitat = new ArcGISDynamicMapServiceLayer("http://dev.services.coastalresilience.org/arcgis/rest/services/Maine/Future_Habitat/MapServer", {
						visible: false
					});
					this.layers.wildlife_habitat.setVisibleLayers([10]);
					this.map.addLayer(this.layers.wildlife_habitat);
				}

				if (!this.layers.non_tidal_wetlands) {
					this.layers.non_tidal_wetlands = new ArcGISDynamicMapServiceLayer("http://dev.services.coastalresilience.org/arcgis/rest/services/Maine/Future_Habitat/MapServer", {
						visible: false
					});
					this.layers.non_tidal_wetlands.setVisibleLayers([7]);
					this.map.addLayer(this.layers.non_tidal_wetlands);
				}

				if (!this.layers.marshHabitat) {
					this.layers.marshHabitat = new ArcGISDynamicMapServiceLayer("http://dev.services.coastalresilience.org/arcgis/rest/services/Maine/Future_Habitat/MapServer", {
						id: 'marshHabitat'
					});
					this.layers.marshHabitat.setVisibleLayers([2]);
					this.map.addLayer(this.layers.marshHabitat);
				}

				// NOTE There is an ESRI bug where some pixels render on the canvas before the minscale
				// I've "fixed" this bug by hiding the canvas layer in css before the minScale is reached
				// If adjusting the scale, update the css
				if (!this.layers.parcels) {
					this.layers.parcels = new VectorTileLayer("http://tiles.arcgis.com/tiles/F7DSX1DSNSiWmOqh/arcgis/rest/services/Maine_Parcels_Coastal/VectorTileServer", {
						id: "mainMapParcelVector",
						minScale: 36111.911040
					});
					this.map.addLayer(this.layers.parcels);

					// TODO Clean this up when deactivated 
					this.parcelGraphics = new esri.layers.GraphicsLayer();
					this.map.addLayer(this.parcelGraphics);
				}

				if (!this.layers.road_stream_crossing) {
					this.layers.road_stream_crossing = new ArcGISDynamicMapServiceLayer("http://dev.services.coastalresilience.org/arcgis/rest/services/Maine/Future_Habitat/MapServer", {
						visible: false
					});
					this.layers.road_stream_crossing.setVisibleLayers([0]);
					this.map.addLayer(this.layers.road_stream_crossing);
				}


				if (!this.layers.regions) {
					// We use snapshot mode because we need all the features locally for querying attributes
					this.layers.regions = new FeatureLayer("http://dev.services.coastalresilience.org/arcgis/rest/services/Maine/Future_Habitat/MapServer/8", {
						mode: FeatureLayer.MODE_SNAPSHOT,
						outFields: ['*']
					});
					this.map.addLayer(this.layers.regions);
					
					this.layers.regions.on('mouse-over', function(e) {
						if (self.map.getZoom() < 10) {
							self.regionGraphics.clear();
							var highlightGraphic = new Graphic(e.graphic.geometry, self.regionSymbolHover, e.graphic.attributes);
							self.regionGraphics.add(highlightGraphic);
						}
						
					});

					// TODO Clean this up when deactivated 
					this.regionGraphics = new esri.layers.GraphicsLayer();
					this.map.addLayer(this.regionGraphics);
					this.regionGraphics.on('click', function(e) {
						if (self.map.getZoom() < 10) {

							self.map.setExtent(e.graphic.geometry.getExtent());
							self.$el.find('#chosenRegion').val(e.graphic.attributes.NAME).trigger("chosen:updated");

							self.setMarshScenarioStats({
								current: e.graphic.attributes.Current_Tidal_Marsh_Acres,
								ft1: e.graphic.attributes.CurrentPlus1Ft_Acres,
								ft2: e.graphic.attributes.CurrentPlus2Ft_Acres,
								ft33: e.graphic.attributes.CurrentPlus3Ft_Acres,
								ft6: e.graphic.attributes.CurrentPlus6Ft_Acres,
								barriers: e.graphic.attributes.Barrier_Count,
								wetlands: e.graphic.attributes.Non_Tidal_Wetland_Acres
							});
							self.regionGraphics.clear();
						}
					});

					// TODO: Clean this up when deactivated
					this.map.on('zoom-end', function(z) {
						if (z.level >= 11) {
							self.regionGraphics.clear();
						}

						if (z.level >= 13) {
							self.$el.find('.parcel-label').show();
							self.$el.find('#parcel-id').show();
							self.$el.find('.hint').hide();
						} else {
							self.$el.find('.parcel-label').hide();
							self.$el.find('#parcel-id').html('').hide();
							self.$el.find('.hint').show();
							self.parcelGraphics.clear();
						}
					});
				}

				this.map.on('click', function(e) {
					var zoom = self.map.getZoom();
					if (zoom >= 13) {
						self.getParcelByPoint(e.mapPoint);
					}


				});

				//this.zoomToRegion('Maine');
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

			beforePrint: function(printDeferred, $printArea, mapObject) {
                // We can short circuit the plugin print chain by simply
                // rejecting this deferred object.
                //printDeferred.reject();

                if (this.layers.lidar.visible) {
					var lidarlyr = new WMSLayer("http://mapserver.maine.gov/wms/mapserv.exe?map=c:/wms/topos.map", {
						visibleLayers: ['medem2_hill','medem2_overview10_hill','medem2_overview30_hill','medem2_overview100_hill']
					});
					mapObject.addLayer(lidarlyr);
				}

				if (this.layers.current_conservation_lands.visible) {
					var conLand = new ArcGISDynamicMapServiceLayer("http://cumulus-web-adapter-1827610810.us-west-1.elb.amazonaws.com/arcgis/rest/services/EasternDivision/SECUREDAREAS2014_S_A_Map_Service_2014_Public/MapServer");
					mapObject.addLayer(conLand);
				}

               	var visibleLayers = [].concat(this.layers.marshHabitat.visibleLayers)
               							.concat(this.layers.non_tidal_wetlands.visible ? this.layers.non_tidal_wetlands.visibleLayers : [])
               							.concat(this.layers.wildlife_habitat.visible ? this.layers.wildlife_habitat.visibleLayers : [])
               							.concat(this.layers.road_stream_crossing.visible ? this.layers.road_stream_crossing.visibleLayers : []);

                var genLyr = new ArcGISDynamicMapServiceLayer("http://dev.services.coastalresilience.org/arcgis/rest/services/Maine/Future_Habitat/MapServer");
					genLyr.setVisibleLayers(visibleLayers);
					mapObject.addLayer(genLyr);

				var regionlyr = new FeatureLayer("http://dev.services.coastalresilience.org/arcgis/rest/services/Maine/Future_Habitat/MapServer/8", {
					mode: FeatureLayer.MODE_SNAPSHOT,
					outFields: ['*']
				});

                mapObject.addLayer(regionlyr);

                

                // TODO Parcel vector Layer is not working in this map, so using dynamic service
				var parcelLyr = new ArcGISDynamicMapServiceLayer("http://dev.services.coastalresilience.org/arcgis/rest/services/Maine/Future_Habitat/MapServer", {
					minScale: 36111.911040
				});
				parcelLyr.setVisibleLayers([1]);
				mapObject.addLayer(parcelLyr);

				if (this.selectedParcel) {
                	var highlightGraphic = new Graphic(this.selectedParcel.geometry, this.highlightParcelSymbol);
                	mapObject.graphics.add(highlightGraphic);
                }


                $printArea.append('<div class="header"><div id="print-title-map"></div><div id="print-subtitle-map"></div></div>');
                $printArea.append('<div id="print-cons-measures"><div class="title">Conservation Measures</div>' +
					'<div class="stats"><div class="stat marsh">' +
					'<div class="description">Tidal Marsh Area</div>' +
					'<div><div class="icon grass"></div>' +
					'<span class="value">22,371</span> <span class="units">acres</span>' +
					'</div></div>' +
					'' +
					'<Br>' +
					'<div class="stat wetlands">' +
					'<div class="description">Non-Tidal Wetlands Area</div>' +
					'<div><div class="icon bird"></div>' +
					'<span class="value">406,231</span> <span class="units">acres</span>' +
					'</div></div>' +
					'' +
					'<br>' +
					'<div class="stat barriers">' +
					'<div class="description">Road Crossing Barriers Nearby</div>' +
					'<div><div class="icon fish"></div>' +
					'<span class="value">2,198</span>' +
					'</div></div>' +
                	'</div></div>');

                $printArea.find('.stat.marsh .value').html(this.$el.find(".current-salt-marsh .value").html());
                $printArea.find('.stat.wetlands .value').html(this.$el.find(".inland-wetlands .value").html());
                $printArea.find('.stat.barriers .value').html(this.$el.find(".roadcrossing-potential .value").html());

                $printArea.append('<div id="custom-print-legend"><div class="title">Legend</div></div>');
                $printArea.append('<div id="custom-print-footer">' +
                	'<div class="big-title">Coastal Resilience - Maine Future Habitat Mapping Tool</div>' +
                	'<div class="custom-print-footer-content">Tidal Marsh Data: Maine Natural Areas Program (MNAP)<br>' +
                	'SLR Projections: Maine Geological Survey, MNAP<br>' +
                	'Application Development: The Nature Conservancy' +
                	'<img class="print-logo" src="img/logo-nature-notagline.png" />' +
                	'</div>');




                var customFormHtml = '<div id="future-habitat-custom-print-form">' + 
	                	'<label class="lbl-text">Title (Optional)</label><input type="text" id="print-title" />' +
	                	'<label class="lbl-text">Subtitle (Optional)</label><input type="text" id="print-subtitle" />' + 
	                	'<label class="form-component">' +
							'<input id="print-cons" type="checkbox" checked>' +
							'<div class="check"></div>' +
							'<span class="form-text">Include Conservation Measures</span>' +
						'</label>' +
	                '</div>';

	            $("#legend-container-0").clone().appendTo('#custom-print-legend');
	            $('#print-cons-measures .title').html($(".main-controls h3").html()).find("br").remove();


				var injectionPoint = $('#plugin-print-preview .print-preview-container');

				injectionPoint.before(customFormHtml);

				$("#print-title").on('blur', function(e) {
					$("#print-title-map").html(e.target.value);
				});

				$("#print-subtitle").on('blur', function(e) {
					$("#print-subtitle-map").html(e.target.value);
				});

				$("#print-cons").on('change', function(e) {
					if (e.target.checked) {
						$("#print-cons-measures").show();
						$("#custom-print-legend").css({height: '4in'});
					} else {
						$("#print-cons-measures").hide();
						$("#custom-print-legend").css({height: '7.2in'});
					}
					
				});

				printDeferred.resolve();
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
						self.$el.find('.salt-marsh-control').attr('data-scenario-idx', ui.value);
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
				}).slider('float', {
					//labels: saltMarshLabels
				});

				this.$el.find('.info').tooltip({

				});

				this.bindEvents();
			},

			zoomToRegion: function(region) {
				var self = this;

				this.$el.find('.region-label').html(region);

				if (region === 'Maine') {
					// TODO When initially activated, the region layer isn't loaded, so stats are unavailable
					this.map.setExtent(this.defaultExtent);

					self.setMarshScenarioStats({
						current: _.reduce(this.layers.regions.graphics, function(mem, graphic) {
							return mem + graphic.attributes.Current_Tidal_Marsh_Acres;
						}, 0),
						ft1: _.reduce(this.layers.regions.graphics, function(mem, graphic) {
							return mem + graphic.attributes.CurrentPlus1Ft_Acres;
						}, 0),
						ft2: _.reduce(this.layers.regions.graphics, function(mem, graphic) {
							return mem + graphic.attributes.CurrentPlus2Ft_Acres;
						}, 0),
						ft33: _.reduce(this.layers.regions.graphics, function(mem, graphic) {
							return mem + graphic.attributes.CurrentPlus3Ft_Acres;
						}, 0),
						ft6: _.reduce(this.layers.regions.graphics, function(mem, graphic) {
							return mem + graphic.attributes.CurrentPlus6Ft_Acres;
						}, 0),
						barriers: _.reduce(this.layers.regions.graphics, function(mem, graphic) {
							return mem + graphic.attributes.Barrier_Count;
						}, 0),
						wetlands: _.reduce(this.layers.regions.graphics, function(mem, graphic) {
							return mem + graphic.attributes.Non_Tidal_Wetland_Acres;
						}, 0),
					});

				} else {
					_.each(this.layers.regions.graphics, function(graphic) {
						if (graphic.attributes.NAME === region) {

							// TODO Select based off of current salt marsh scenario
							// TODO Add commas as thousands selector
						
							self.setMarshScenarioStats({
								current: graphic.attributes.Current_Tidal_Marsh_Acres,
								ft1: graphic.attributes.CurrentPlus1Ft_Acres,
								ft2: graphic.attributes.CurrentPlus2Ft_Acres,
								ft33: graphic.attributes.CurrentPlus3Ft_Acres,
								ft6: graphic.attributes.CurrentPlus6Ft_Acres,
								barriers: graphic.attributes.Barrier_Count,
								wetlands: graphic.attributes.Non_Tidal_Wetland_Acres
							});

							self.map.setExtent(graphic.geometry.getExtent());
							return false;
						}
					});

				}

				this.parcelGraphics.clear();
			},

			setMarshScenario: function(idx) {

				this.$el.find('.salt-marsh-control').attr('data-scenario-idx', idx);

				switch(parseInt(idx)) {
					case 0:
						this.layers.marshHabitat.setVisibleLayers([2]);
						break;
					case 1:
						this.layers.marshHabitat.setVisibleLayers([2, 3]);
						break;
					case 2:
						this.layers.marshHabitat.setVisibleLayers([2, 3, 4]);
						break;
					case 3:
						this.layers.marshHabitat.setVisibleLayers([2, 3, 4, 5]);
						break;
					case 4:
						this.layers.marshHabitat.setVisibleLayers([2, 3, 4, 5, 6]);
						break;
				}

				this.layers.marshHabitat.refresh();
				this.updateStatistics();
			},

			setMarshScenarioStats: function(values) {
				var control = this.$el.find('.salt-marsh-control');

				control.attr('data-scenario-current', values.current);
				control.attr('data-scenario-ft1', values.ft1);
				control.attr('data-scenario-ft2', values.ft2);
				control.attr('data-scenario-ft33', values.ft33);
				control.attr('data-scenario-ft6', values.ft6);
				control.attr('data-scenario-barriers', values.barriers);
				control.attr('data-scenario-wetlands', values.wetlands);

				this.updateStatistics();
			},

			updateStatistics: function() {
				var control = this.$el.find('.salt-marsh-control');
				var idx = control.attr('data-scenario-idx');
				var saltMarshValue;
				var wetlandValue = control.data('scenario-wetlands');

				switch(parseInt(idx)) {
					case 0:
						saltMarshValue = control.attr('data-scenario-current');
						break;
					case 1:
						saltMarshValue = control.attr('data-scenario-ft1');
						break;
					case 2:
						saltMarshValue = control.attr('data-scenario-ft2');
						break;
					case 3:
						saltMarshValue = control.attr('data-scenario-ft33');
						break;
					case 4:
						saltMarshValue = control.attr('data-scenario-ft6');
						break;
				}

				if (parseFloat(saltMarshValue) > 100) {
					saltMarshValue = parseInt(saltMarshValue);
				} else {
					saltMarshValue = parseFloat(saltMarshValue).toFixed(1);
				}

				if (parseFloat(wetlandValue) > 100) {
					wetlandValue = parseInt(wetlandValue);
				} else {
					wetlandValue = parseFloat(wetlandValue).toFixed(1);
				}

				this.$el.find('.current-salt-marsh .number .value').html(this.addCommas(saltMarshValue));
				this.$el.find('.inland-wetlands .number .value').html(this.addCommas(wetlandValue));
				this.$el.find('.roadcrossing-potential .number .value').html(this.addCommas(control.data('scenario-barriers')));
			},

			getParcelByPoint: function(pt) {
				var self = this;
				this.qParcels.geometry = pt;
				this.qtParcels.execute(this.qParcels, function(results) {
					if (results.features.length) {
						var parcel = self.selectedParcel = results.features[0];
						var crossings = parcel.attributes.Crossings_100m_List.split(',');

						self.$el.find('.parcel-label').show();
						self.$el.find('#parcel-id').html(parcel.attributes.Parcel_Name);
						self.$el.find('.region-label').html(parcel.attributes.Parcel_Name);

						self.setMarshScenarioStats({
							current: parcel.attributes.Current_Tidal_Marsh_Acres,
							ft1: parcel.attributes.CurrentPlus1Ft_Acres,
							ft2: parcel.attributes.CurrentPlus2Ft_Acres,
							ft33: parcel.attributes.CurrentPlus3Ft_Acres,
							ft6: parcel.attributes.CurrentPlus6Ft_Acres,
							barriers: parcel.attributes.Barrier_Count_100m,
							wetlands: parcel.attributes.Non_Tidal_Wetland_Acres
						});
						self.updateStatistics();

						self.parcelGraphics.clear();
						var highlightGraphic = new Graphic(parcel.geometry, self.highlightParcelSymbol);
						self.parcelGraphics.add(highlightGraphic);

						//self.setSelectedMarshByParcel(parcel.attributes.Parcel_ID_Unique);

						// TODO Potential Race condition fix where clicking on a new parcel before this finishes loading
						// TODO Selected Barriers don't show up in legend
						/*self.qCrossings.where = "SiteID = '" + crossings.join("' OR SiteID = '") + "'";
						self.qtCrossings.execute(self.qCrossings, function(crossing_result) {
							_.each(crossing_result.features, function(feature) {
								var crossingGraphic = new Graphic(feature.geometry, self.selectedBarrierSymbol);
								self.parcelGraphics.add(crossingGraphic);
							});
						});*/

					} else {
						self.$el.find('.parcel-label').hide();
						self.selectedParcel = null;
					}
					
				});
			},

			setSelectedMarshByParcel: function(parcelId) {
				return;
				/*if (parcelId) {
					var marshHabitatParcelsDefinitions = [];
					marshHabitatParcelsDefinitions[6] = "Parcel_ID_Unique = " + parcelId;
					marshHabitatParcelsDefinitions[2] = "Parcel_ID_Unique = " + parcelId;
					marshHabitatParcelsDefinitions[3] = "Parcel_ID_Unique = " + parcelId;
					marshHabitatParcelsDefinitions[4] = "Parcel_ID_Unique = " + parcelId;
					marshHabitatParcelsDefinitions[5] = "Parcel_ID_Unique = " + parcelId;
					this.layers.marshHabitatParcels.setLayerDefinitions(marshHabitatParcelsDefinitions);
					this.layers.marshHabitatParcels.setVisibility(true);

					var non_tidal_wetlands_Definitions = [];
					non_tidal_wetlands_Definitions[7] = "Parcel_ID_Unique = " + parcelId;
					//this.layers.non_tidal_wetlands_parcels.setLayerDefinitions(non_tidal_wetlands_Definitions);
					//this.layers.non_tidal_wetlands_parcels.setVisibility(true);
				} else {
					//this.layers.non_tidal_wetlands_parcels.setVisibility(false);
					//this.layers.marshHabitatParcels.setVisibility(false);
				}*/
			},

			// http://stackoverflow.com/questions/2646385/add-a-thousands-separator-to-a-total-with-javascript-or-jquery
			addCommas: function(nStr) {
			    nStr += '';
			    var x = nStr.split('.');
			    var x1 = x[0];
			    var x2 = x.length > 1 ? '.' + x[1] : '';
			    var rgx = /(\d+)(\d{3})/;
			    while (rgx.test(x1)) {
			        x1 = x1.replace(rgx, '$1' + ',' + '$2');
			    }
			    return x1 + x2;
			}


		});

	}
);
