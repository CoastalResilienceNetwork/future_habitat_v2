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
    "dojo/text!./print_template.html",
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
		print_template,
		template
	) {

		// TODO: Clear currently selected parcel button

		return declare(PluginBase, {
			toolbarName: 'Future Habitat',
			resizable: false,
			width: 425,
			size: 'custom',
			allowIdentifyWhenActive: false,
			hasCustomPrint: true,
			//usePrintPreviewMap: true,
			//previewMapSize: [500, 300],
			layers: {},
			defaultExtent: new Extent(-7959275, 5087981, -7338606, 5791202, new SpatialReference({wkid: 102100})),
			selectedParcel: null,
			marshScenarioIdx: null,

			initialize: function(frameworkParameters) {
				declare.safeMixin(this, frameworkParameters);
				this.$el = $(this.container);

				// This hack removes a mismatch jquery-ui stylesheet.
				// Hack needs to be removed when framework is upgraded
				$('link[rel=stylesheet][href~="http://code.jquery.com/ui/1.11.3/themes/smoothness/jquery-ui.css"]').remove();

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

				this.qtRegions = new QueryTask('http://dev.services.coastalresilience.org/arcgis/rest/services/Maine/Future_Habitat/MapServer/8');
				this.qRegions = new Query();
				this.qRegions.outFields = ['*'];
				this.qRegions.returnGeometry = false;

				// Setup graphic styles
				
				this.regionSymbol = new SimpleFillSymbol(
					SimpleFillSymbol.STYLE_SOLID,
					new SimpleLineSymbol(
						SimpleLineSymbol.STYLE_SOLID,
						new Color([255,204,0,1]),
						5
					),
					new Color([255, 255, 255, 0])
				);

				this.selectedBarrierSymbol = new SimpleMarkerSymbol(
					SimpleMarkerSymbol.STYLE_CIRCLE,
					17,
				    new SimpleLineSymbol(
						SimpleLineSymbol.STYLE_SOLID,
						new Color([255, 235, 59, 1]),
						3
					),
					new Color([225, 96, 82, 1])
				);

				this.highlightParcelSymbol = new SimpleFillSymbol(
					SimpleFillSymbol.STYLE_SOLID,
					new SimpleLineSymbol(
						SimpleLineSymbol.STYLE_SOLID,
						new Color([255,204,0,0.5]),
						4
					),
					new Color([255, 255, 255, 0.0])
				);
				$(this.legendContainer).html('<div class="selected-barrier-lgnd" style="display: none;"><svg width="20" height="20"><circle fill="rgb(225, 96, 82)" stroke="rgb(255, 235, 59)" stroke-width="3" cx="10" cy="10" r="7"></circle></svg> <span style="position: relative; top:-5px;">Selected Barrier</span></div>');

				return this;
			},

			bindEvents: function() {
				var self = this;
				this.$el.find('.transparency-label').on('mousedown', function() {
					var control = $(this).parent('.transparency-control').toggleClass('open');
					var dataLayer = control.attr('data-layer');
					if (control.hasClass('open')) {
						$('body').on('click.tranSlider', function(e) {
							if ($(e.target).parents('.transparency-control[data-layer=' + dataLayer + ']').length || ($(e.target).hasClass('transparency-control') && $(e.target).attr('data-layer') === dataLayer)) {
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
					// self.printButton.trigger('click');
					TINY.box.show({
				        animate: true,
				        url: 'plugins/future-habitat-v2/print-setup.html',
				        fixed: true,
				        width: 390,
				        height: 330,
				        openjs: function(a) {
				        	self.center = self.map.extent.getCenter();
				        	$('#generate-print').on('click', function() {
								var link = $('<link />')
									.attr('href', 'plugins/future-habitat-v2/custom-print.css')
									.attr('rel', 'stylesheet')
									.attr('class', 'future-habitat-custom-print');

								link.on('load', function() {
									
									self.map.resize(true);
									// RESIZE callback promise is not resolving.  ArcGIS 3.20 version bug?
									self.map.centerAt(self.center);
									_.delay(function() {
										if (self.map.updating) {
											self.finishloading = self.map.on('update-end', function() {
												self.finishloading.remove();
												window.print();
												TINY.box.hide();
											})
										} else {
											window.print();
											TINY.box.hide();
										}

										// Default ESRI pan animation duration is 350.  May want to 
										// just disable animations for this function
									}, 550)
									


								})
								$('head').append(link);

								$("#print-title-map").html($("#print-title").val());
								$("#print-subtitle-map").html($("#print-subtitle").val());
								if ($("#print-subtitle").val().length === 0) {
									$('.title-sep').hide();
								}
							});

				        	$("body").append(_.template(print_template, {}));
				        	$("#legend-container-0").clone().removeAttr("id")
				        		.removeClass('minimized')
				        		.removeAttr('style')
				        		.appendTo('#custom-print-legend');
			                $('#print-cons-measures .stat.marsh .value').html(self.$el.find(".current-salt-marsh .value").html());
			                $('#print-cons-measures .stat.wetlands .value').html(self.$el.find(".inland-wetlands .value").html());
			                $('#print-cons-measures .stat.barriers .value').html(self.$el.find(".roadcrossing-potential .value").html());
				            $("#custom-print-legend .legend-body").show();
				            $('#print-cons-measures .title').html($(".main-controls h3").html()).find("br").remove();

				        },
				        closejs: function() {
				        	$("#print-page").remove();
				        	$(".future-habitat-custom-print").remove();
			        		self.map.resize(true);
		        			self.map.centerAt(self.center);
			        		$('#generate-print').off()
			        		if (self.finishloading) {
			        			self.finishloading.remove();
			        		}
			        	}

				    });

				    
				});



				this.$el.find('.export .notes').on('click', function() {
					TINY.box.show({
				        animate: true,
				        url: 'plugins/future-habitat-v2/notes.html',
				        fixed: true,
				        width: 560,
				        height: 700
				    });
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
					this.layers.current_conservation_lands = new ArcGISDynamicMapServiceLayer("http://dev.services.coastalresilience.org/arcgis/rest/services/Maine/Future_Habitat/MapServer", {
						visible: false
					});
					this.layers.current_conservation_lands.setVisibleLayers([8]);
					this.map.addLayer(this.layers.current_conservation_lands);
				}
				
				if (!this.layers.wildlife_habitat) {
					this.layers.wildlife_habitat = new ArcGISDynamicMapServiceLayer("http://dev.services.coastalresilience.org/arcgis/rest/services/Maine/Future_Habitat/MapServer", {
						visible: false
					});
					this.layers.wildlife_habitat.setVisibleLayers([11]);
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
					this.layers.parcelGraphics = new esri.layers.GraphicsLayer({
						minScale: 36111.911040
					});
					this.map.addLayer(this.layers.parcelGraphics);

				
				}



				if (!this.layers.road_stream_crossing) {

					this.layers.road_stream_crossing = new ArcGISDynamicMapServiceLayer("http://dev.services.coastalresilience.org/arcgis/rest/services/Maine/Future_Habitat/MapServer", {
						visible: false
					});
					this.layers.road_stream_crossing.setVisibleLayers([0]);
					this.map.addLayer(this.layers.road_stream_crossing);

					this.layers.crossingGraphics = new esri.layers.GraphicsLayer({
						minScale: 36111.911040
					});
					this.map.addLayer(this.layers.crossingGraphics);
				}


				if (!this.layers.regions) {

					

					this.layers.selectedRegionGraphics = new esri.layers.GraphicsLayer();
					this.map.addLayer(this.layers.selectedRegionGraphics);

					this.layers.regionGraphics = new esri.layers.GraphicsLayer({
						maxScale: 36111.911040
					});
					this.map.addLayer(this.layers.regionGraphics);


					// We use snapshot mode because we need all the features locally for querying attributes
					this.layers.regions = new FeatureLayer("http://dev.services.coastalresilience.org/arcgis/rest/services/Maine/Future_Habitat/MapServer/9", {
						mode: FeatureLayer.MODE_SNAPSHOT,
						outFields: ['*']
					});
					this.map.addLayer(this.layers.regions);
					
					this.layers.regions.on('mouse-over', function(e) {
						//if (self.map.getZoom() < 14) {
							self.layers.regionGraphics.clear();
							var highlightGraphic = new Graphic(e.graphic.geometry, self.regionSymbol, e.graphic.attributes);
							self.layers.regionGraphics.add(highlightGraphic);
						//}
						
					});

					this.layers.regions.on('mouse-out', function() {
						self.layers.regionGraphics.clear();
					});

					this.layers.regions.on('click', function(e) {
						//if (self.map.getZoom() < 14) {

							if (e.graphic.attributes.NAME !== self.$el.find('#chosenRegion').val() && self.map.getZoom() < 14) {
								self.zoomToRegion(e.graphic.attributes.NAME);
							}

							self.$el.find('#chosenRegion').val(e.graphic.attributes.NAME).trigger("chosen:updated");

							if (self.map.getZoom() < 14) {
								self.layers.selectedRegionGraphics.clear();
								var highlightGraphic = new Graphic(e.graphic.geometry, self.regionSymbol, e.graphic.attributes);
								self.layers.selectedRegionGraphics.add(highlightGraphic);

								self.$el.find('.region-label').html(e.graphic.attributes.NAME);
								
								self.setMarshScenarioStats({
									current: e.graphic.attributes.Current_Tidal_Marsh_Acres,
									ft1: e.graphic.attributes.CurrentPlus1Ft_Acres,
									ft2: e.graphic.attributes.CurrentPlus2Ft_Acres,
									ft33: e.graphic.attributes.CurrentPlus3Ft_Acres,
									ft6: e.graphic.attributes.CurrentPlus6Ft_Acres,
									barriers: e.graphic.attributes.Barrier_Count,
									wetlands: e.graphic.attributes.Non_Tidal_Wetland_Acres
								});

							}						
					});




					// TODO: Clean this up when deactivated
					this.map.on('zoom-end', function(z) {
						/*if (z.level >= 11) {
							self.regionGraphics.clear();
						}*/

						if (z.level >= 13) {
							self.$el.find('.parcel-label').show();
							self.$el.find('#parcel-id').show();
							self.$el.find('.hint').hide();
						} else {
							self.$el.find('.parcel-label').hide();
							self.$el.find('#parcel-id').html('').hide();
							self.$el.find('.hint').show();
							self.layers.parcelGraphics.clear();
							self.layers.crossingGraphics.clear();
							$('.selected-barrier-lgnd').hide();
							self.map.resize();
						}
					});
				}

				this.map.on('click', function(e) {
					var zoom = self.map.getZoom();
					if (zoom >= 14) {
						self.getParcelByPoint(e.mapPoint);
					}

					/*if (zoom < 14 && zoom >= 11) {
						self.qRegions.geometry = e.mapPoint;
						self.qtRegions.execute(self.qRegions, function(results) {
							if (results.features.length) {
								self.$el.find('.region-label').html(results.features[0].attributes.NAME);
								self.$el.find('#chosenRegion').val(results.features[0].attributes.NAME).trigger("chosen:updated");
								self.setMarshScenarioStats({
									current: results.features[0].attributes.Current_Tidal_Marsh_Acres,
									ft1: results.features[0].attributes.CurrentPlus1Ft_Acres,
									ft2: results.features[0].attributes.CurrentPlus2Ft_Acres,
									ft33: results.features[0].attributes.CurrentPlus3Ft_Acres,
									ft6: results.features[0].attributes.CurrentPlus6Ft_Acres,
									barriers: results.features[0].attributes.Barrier_Count,
									wetlands: results.features[0].attributes.Non_Tidal_Wetland_Acres
								});
							}
						});
					}*/

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
            			control.attr('data-opacity', ui.value);
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

							self.map.setExtent(graphic.geometry.getExtent(), true);
							return false;
						}
					});

				}

				this.layers.parcelGraphics.clear();
				this.layers.crossingGraphics.clear();
				$('.selected-barrier-lgnd').hide();
				self.map.resize();
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
				var wetlandValue = control.attr('data-scenario-wetlands');

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
				this.$el.find('.roadcrossing-potential .number .value').html(this.addCommas(control.attr('data-scenario-barriers')));
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

						self.layers.selectedRegionGraphics.clear();
						self.layers.parcelGraphics.clear();
						self.layers.crossingGraphics.clear();
						var highlightGraphic = new Graphic(parcel.geometry, self.highlightParcelSymbol);
						self.layers.parcelGraphics.add(highlightGraphic);

						//self.setSelectedMarshByParcel(parcel.attributes.Parcel_ID_Unique);

						// TODO Potential Race condition fix where clicking on a new parcel before this finishes loading
						// TODO Selected Barriers don't show up in legend
						self.qCrossings.where = "SiteID = '" + crossings.join("' OR SiteID = '") + "'";
						self.qtCrossings.execute(self.qCrossings, function(crossing_result) {
							_.each(crossing_result.features, function(feature) {
								var crossingGraphic = new Graphic(feature.geometry, self.selectedBarrierSymbol);
								self.layers.crossingGraphics.add(crossingGraphic);
							});
							if (crossing_result.features.length) {
								$('.selected-barrier-lgnd').show();
							} else {
								$('.selected-barrier-lgnd').hide();
							}
							self.map.resize();
						});

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
