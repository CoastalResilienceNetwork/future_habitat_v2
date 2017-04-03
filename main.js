define([
	"dojo/_base/declare",
	"framework/PluginBase",
	"dijit/layout/ContentPane",
    "dojo/dom",
    "dojo/text!./template.html",
	], function(declare,
		PluginBase,
		ContentPane,
		dom,
		template
	) {

		return declare(PluginBase, {
			toolbarName: 'Future Habitat Explorer',
			resizable: false,
			width: 425,
			size: 'custom',

			initialize: function(frameworkParameters) {
				declare.safeMixin(this, frameworkParameters);
				this.$el = $(this.container);
			},

			bindEvents: function() {
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
				})

				this.$el.find('.layer input').on('change', function(e) {
					var checked = this.checked;
					var layer = $(e.target).parents('.layer');

					if (checked) {
						layer.find('.transparency-control').css('display', 'inline-block');
					} else {
						layer.find('.transparency-control').css('display', 'none');
					}
				});
			},

			activate: function() {
				this.render();
			},

			deactivate: function() {

			},

			hibernate: function() {

			},

			render: function() {

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
                	'3.3&nbsp;ft'
                ];

                this.$el.find("#salt-marsh-slider").slider({
            		min: 0,
            		max: 3,
            		range: false,
				}).slider('pips',  { 
					rest: 'label',
					labels: saltMarshLabels
				});

                this.$el.find(".transparency-slider .slider").slider({
            		min: 0,
            		max: 100,
            		step: 1,
            		value: [100],
            		range: false,
            		slide: function(e, ui) {
						$(e.target).parents('.transparency-control').find('.value').html(ui.value + '%');
            		}
				});

				this.bindEvents();
			}

		});

	}
);
