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
    './State',
    'dojo/text!./region.json',
    'dojo/text!./print-setup.html',
    "dojo/text!./print_template.html",
    "dojo/text!./print_stat_template.html",
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
		State,
		RegionConfig,
		print_setup,
		print_template,
		print_stat_template,
		template
	) {

		// TODO: Clear currently selected parcel button

		return declare(PluginBase, {
			toolbarName: 'Future Habitat',
			resizable: false,
			width: 425,
			size: 'custom',
			allowIdentifyWhenActive: false,
			layers: {},
			hasCustomPrint: true,
			usePrintModal: true,
			printModalSize: [390, 330],
			selectedParcel: null,
			marshScenarioIdx: null,

			initialize: function(frameworkParameters) {
				declare.safeMixin(this, frameworkParameters);
				this.state = new State({});
				this.$el = $(this.container);
				this.regionConfig = $.parseJSON(RegionConfig);
				this.slrIdx = 0; // Scenario array index
				this.defaultExtent = new Extent(
					this.regionConfig.defaultExtent[0],
					this.regionConfig.defaultExtent[1],
					this.regionConfig.defaultExtent[2],
					this.regionConfig.defaultExtent[3],
					new SpatialReference({wkid: 102100})
				);
				this.region = this.state.getRegion();
				$(this.printButton).hide();

				// Setup query handles
				if (Number.isInteger(this.regionConfig.parcelsLayer)) {
					this.qtParcels = new QueryTask(this.regionConfig.service + '/' + this.regionConfig.parcelsLayer);
					this.qParcels = new Query();
					this.qParcels.returnGeometry = true;
					this.qParcels.outFields = ['*'];
				}
				
				if (Number.isInteger(this.regionConfig.road_stream_crossing)) {
					this.qtCrossings = new QueryTask(this.regionConfig.service + '/' + this.regionConfig.road_stream_crossing);
					this.qCrossings = new Query();
					this.qCrossings.returnGeometry = true;
				}

				/*if (Number.isInteger(this.regionConfig.regionLayer))  {
					this.qtRegions = new QueryTask(this.regionConfig.service + '/' + this.regionConfig.regionLayer);
					this.qRegions = new Query();
					this.qRegions.outFields = ['*'];
					this.qRegions.returnGeometry = false;
				}*/

				var regionQuery = new Query();
                var queryTask = new QueryTask(this.regionConfig.service + '/' + this.regionConfig.regionLayer);
                regionQuery.where = '1=1';
                regionQuery.returnGeometry = false;
                regionQuery.outFields = ['*'];
                queryTask.execute(regionQuery, _.bind(this.processRegionStats, this));

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

			processRegionStats: function(data) {
				var self = this;
				var transformedData = {};
				var globalStats = {};
				$.each(data.features, function(idx, datum) {
					transformedData[datum.attributes[self.regionConfig.regionAttributeLabel]] = datum.attributes;
					$.each(Object.keys(datum.attributes), function(idx, key) {
						globalStats[key] = globalStats[key] + datum.attributes[key] || datum.attributes[key];
					});
				});
				this.stats = transformedData;
				this.stats.global = globalStats;
				this.render();
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
					self.region = e.target.value;
					self.state = self.state.setRegion(self.region);
					self.zoomToRegion(e.target.value);
				});

				this.$el.find('.export .print').on('click', function() {
					self.$el.parent('.sidebar').find('.plugin-print').trigger('click');
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

			prePrintModal: function (preModalDeferred, $printArea, modalSandbox, mapObject) {
				modalSandbox.append(_.template(print_setup, {}));
				$printArea.append(_.template(print_template)({
					printFooterTitle: this.regionConfig.printFooterTitle,
					printFooterBody: this.regionConfig.printFooterBody
				}));
				preModalDeferred.resolve();
			},

			postPrintModal: function(postModalDeferred, modalSandbox, mapObject) {
				$("body").attr('data-con-measures', $('#print-cons').is(':checked'));
				$("#print-title-map").html(modalSandbox.find("#print-title").val());
				$("#print-subtitle-map").html(modalSandbox.find("#print-subtitle").val());
				if ($("#print-subtitle").val().length === 0) {
					$('.title-sep').hide();
				}

				_.each(this.regionConfig.stats, function(stat) {
					var icon = stat.icon;
					var label = stat.label;
					var units = stat.units;
					var acres = stat.acres;
					var statLabel = label.toLowerCase().replace(/ /g, '-').replace(/\//g, '-');
					var statValue = $('[data-stat=' + statLabel + '] .value').html();
					var template = _.template(print_stat_template)({
						icon: icon,
						label: label,
						units: units,
						acres: acres,
						stat: statValue
					});
					$("#print-cons-measures .stats").append(template);

				});

				$('.legend-layer').addClass('show-extras');

				window.setTimeout(function() {
                    postModalDeferred.resolve();
                }, 100);
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
					// Interferes with the save and share extent functionality.  Disable for now.  Will use the
					// frameworks default extent
					if (this.region === this.globalRegion) {
						this.map.setExtent(this.defaultExtent);
					}
				}

				// NOTE Order added here is important because it is draw order on the map
				if (this.regionConfig.lidar && !this.layers.lidar) {
					this.layers.lidar = new WMSLayer(this.regionConfig.lidar, {
						visible: false,
						visibleLayers: this.regionConfig.lidarLayers
					});
					this.map.addLayer(this.layers.lidar);
				}

				if (Number.isInteger(this.regionConfig.current_conservation_lands) && !this.layers.current_conservation_lands) {
					this.layers.current_conservation_lands = new ArcGISDynamicMapServiceLayer(this.regionConfig.service, {
						visible: false
					});
					this.layers.current_conservation_lands.setVisibleLayers([this.regionConfig.current_conservation_lands]);
					this.map.addLayer(this.layers.current_conservation_lands);
				}
				
				if (Number.isInteger(this.regionConfig.wildlife_habitat) && !this.layers.wildlife_habitat) {
					var wildlifeIPs = new ImageParameters();
                    wildlifeIPs.layerIds = [this.regionConfig.wildlife_habitat];
                    wildlifeIPs.layerOption = ImageParameters.LAYER_OPTION_SHOW;	
                    this.layers.wildlife_habitat = new ArcGISDynamicMapServiceLayer(this.regionConfig.service, {
						visible: false,
                        "imageParameters" : wildlifeIPs
					});
					this.map.addLayer(this.layers.wildlife_habitat);
				}

				if (Number.isInteger(this.regionConfig.non_tidal_wetlands) && !this.layers.non_tidal_wetlands) {
					this.layers.non_tidal_wetlands = new ArcGISDynamicMapServiceLayer(this.regionConfig.service, {
						visible: false
					});
                                        
					this.layers.non_tidal_wetlands.setVisibleLayers([this.regionConfig.non_tidal_wetlands]);
					this.map.addLayer(this.layers.non_tidal_wetlands);
				}

				if (this.regionConfig.service && !this.layers.marshHabitat) {
					this.layers.marshHabitat = new ArcGISDynamicMapServiceLayer(this.regionConfig.service, {
						id: 'marshHabitat'
					});
					this.layers.marshHabitat.setVisibleLayers([this.regionConfig.scenarios[0].layer]);
					this.map.addLayer(this.layers.marshHabitat);
				}

				// NOTE There is an ESRI bug where some pixels render on the canvas before the minscale
				// I've "fixed" this bug by hiding the canvas layer in css before the minScale is reached
				// If adjusting the scale, update the css
				if (this.regionConfig.parcels && !this.layers.parcels) {
					this.layers.parcels = new VectorTileLayer(this.regionConfig.parcels, {
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

				if (Number.isInteger(this.regionConfig.road_stream_crossing) && !this.layers.road_stream_crossing) {
					this.layers.road_stream_crossing = new ArcGISDynamicMapServiceLayer(this.regionConfig.service, {
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
					this.layers.regions = new FeatureLayer(this.regionConfig.regionService, {
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
						if (e.graphic.attributes[self.regionConfig.regionAttributeLabel] !== self.$el.find('#chosenRegion').val() && self.map.getZoom() < 14) {
							self.zoomToRegion(e.graphic.attributes[self.regionConfig.regionAttributeLabel]);
						}

						self.$el.find('#chosenRegion').val(e.graphic.attributes[self.regionConfig.regionAttributeLabel]).trigger("chosen:updated");

					});

					// Set marsh scenario.  Will default to 0 unless and share was used to initalize different values
					this.setMarshScenario(this.slrIdx);
					this.$el.find("#salt-marsh-slider").slider("value", this.slrIdx);

					// TODO: Clean this up when deactivated
					this.map.on('zoom-end', function(z) {
						/*if (z.level >= 11) {
							self.regionGraphics.clear();
						}*/

						if (Number.isInteger(self.regionConfig.parcelsLayer)) {
							if (z.level >= 13) {
								self.$el.find('.parcel-label').show();
								self.$el.find('#parcel-id').show();
								self.$el.find('.hint').hide();
							} else {
								self.$el.find('.parcel-label').hide();
								self.$el.find('#parcel-id').html('').hide();
								self.$el.find('.hint').show();
								self.layers.parcelGraphics.clear();
								self.selectedParcel = null;
								self.layers.crossingGraphics.clear();
								$('.selected-barrier-lgnd').hide();
								self.map.resize();
							}
						}
					});
				}

				this.map.on('click', function(e) {
					var zoom = self.map.getZoom();
					if (zoom >= 14) {

						if (self.regionConfig.parcelsLayer) {
							self.getParcelByPoint(e.mapPoint);
						}
					}

					/*if (this.regionConfig.parcelsLayer && zoom < 14 && zoom >= 11) {
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

			},

			deactivate: function() {
				
			},

			hibernate: function() {
				_.each(Object.keys(this.layers), function(layer) {
					this.map.removeLayer(this.layers[layer]);
				}, this);

				// TODO: Cleanup map click events

				this.layers = {};
			},

			render: function() {
				var self = this;
				var saltMarshLabels = this.regionConfig.scenarios.map(function(scenario) {
                	return scenario.label;
                });

				this.$el.html(_.template(template)({
					disclaimer: this.regionConfig.disclaimer,
					intro: this.regionConfig.intro,
					regions: Object.keys(this.stats).sort(),
					regionLabel: this.regionConfig.regionLabel,
					region: this.region,
					globalRegion: this.regionConfig.globalRegion,
					stats: this.regionConfig.stats,
					lidar: this.regionConfig.lidar,
					current_conservation_lands: Number.isInteger(this.regionConfig.current_conservation_lands),
					wildlife_habitat: Number.isInteger(this.regionConfig.wildlife_habitat),
					non_tidal_wetlands: Number.isInteger(this.regionConfig.non_tidal_wetlands),
					road_stream_crossing: Number.isInteger(this.regionConfig.road_stream_crossing)
                }));

                this.$el.find('#chosenRegion').chosen({
                	disable_search_threshold: 20,
                	width: '100%'
                });

                this.$el.find("#salt-marsh-slider").slider({
            		min: 0,
            		max: saltMarshLabels.length - 1,
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
				});

				this.$el.find('.info').tooltip({

				});

				this.updateStatistics();
				this.bindEvents();
			},

			zoomToRegion: function(region) {
				var self = this;

				this.$el.find('.region-label').html(region);
				if (this.layers.selectedRegionGraphics) {
					this.layers.selectedRegionGraphics.clear();	
				}
				
				if (region === this.regionConfig.globalRegion) {
					// TODO When initially activated, the region layer isn't loaded, so stats are unavailable
					this.map.setExtent(this.defaultExtent);
				} else {
					_.each(this.layers.regions.graphics, function(graphic) {
						if (graphic.attributes[self.regionConfig.regionAttributeLabel] === region) {

							// TODO Select based off of current salt marsh scenario
							// TODO Add commas as thousands selector

							if (self.map.getZoom() < 14) {
								var highlightGraphic = new Graphic(graphic.geometry, self.regionSymbol, graphic.attributes);
								self.layers.selectedRegionGraphics.add(highlightGraphic);

								self.$el.find('.region-label').html(graphic.attributes.NAME);
							}

							self.map.setExtent(graphic.geometry.getExtent(), true);
							return false;
						}
					});

				}

				if (this.regionConfig.parcels) {
					this.layers.parcelGraphics.clear();
					this.selectedParcel = null;
					this.layers.crossingGraphics.clear();
				}
				
				$('.selected-barrier-lgnd').hide();
				this.map.resize();
				this.updateStatistics();
			},

			setMarshScenario: function(idx) {
				this.idx = idx;
				this.state = this.state.setSLRIdx(idx);
				this.$el.find('.salt-marsh-control').attr('data-scenario-idx', idx);
				var layerIds = this.regionConfig.scenarios.map(function(scenario) {
					return scenario.layer;
				});

				if (this.regionConfig.scenariosAdditive) {
					this.layers.marshHabitat.setVisibleLayers(layerIds.slice(0, idx + 1));
				} else {
					this.layers.marshHabitat.setVisibleLayers([layerIds[idx]]);
				}
				
				
				this.layers.marshHabitat.refresh();
				this.updateStatistics();
			},

			updateStatistics: function() {
				var self = this;
				var control = this.$el.find('.salt-marsh-control');
				var idx = control.attr('data-scenario-idx');

				_.each(this.regionConfig.stats, function(stat) {
					var statLabel = stat.label.toLowerCase().replace(/ /g, '-').replace(/\//g, '-');
					var regionStats;
					if (self.region === self.regionConfig.globalRegion) {
						regionStats = self.stats.global;
					} else {
						regionStats = self.stats[self.region];
					}
					var field = stat.fields[idx];
					var value = regionStats[field];

					if (parseFloat(value) > 100) {
						value = self.addCommas(parseInt(value));
					} else {
						value = parseFloat(value).toFixed(1);
					}

					self.$el.find("[data-stat='" + statLabel + "']").find('.number .value').html(value);
				});
			},

			setState: function(data) {
				this.state = new State(data);
				this.region = data.region;
				this.slrIdx = data.slrIdx;
				this.$el.find('#chosenRegion').val(data.region).trigger("chosen:updated");
			},

            getState: function(data) {
                return {
                	slrIdx: this.state.getSLRIdx(),
                    region: this.state.getRegion()
                };
            },

			getParcelByPoint: function(pt) {
				var self = this;
				if (this.regionConfig.parcelsLayer) {
					this.qParcels.geometry = pt;
					this.qtParcels.execute(this.qParcels, function(results) {
						if (results.features.length) {
							var parcel = self.selectedParcel = results.features[0];
							var crossings = parcel.attributes.Crossings_100m_List.split(',');

							self.$el.find('.parcel-label').show();
							self.$el.find('#parcel-id').html(parcel.attributes.Parcel_Name);
							self.$el.find('.region-label').html(parcel.attributes.Parcel_Name);

							self.updateStatistics();

							self.layers.selectedRegionGraphics.clear();
							self.layers.parcelGraphics.clear();
							self.layers.crossingGraphics.clear();
							var highlightGraphic = new Graphic(parcel.geometry, self.highlightParcelSymbol);
							self.layers.parcelGraphics.add(highlightGraphic);

							if (Number.isInteger(self.regionConfig.parcelsLayer)) {
								self.setSelectedMarshByParcel(parcel.attributes.Parcel_ID_Unique);
							}

							// TODO Potential Race condition fix where clicking on a new parcel before this finishes loading
							// TODO Selected Barriers don't show up in legend
							if (Number.isInteger(self.regionConfig.road_stream_crossing)) {
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
							}
						} else {
							self.$el.find('.parcel-label').hide();
							self.selectedParcel = null;
						}
						
					});
				}
			},

			setSelectedMarshByParcel: function(parcelId) {
				if (Number.isInteger(this.regionConfig.parcelsLayer)) {
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
				}
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
