'use strict';
define([
        'dojo/_base/declare',
        'underscore',
        'dojo/text!./region.json'
    ],
    function(declare, _, RegionConfig) {

        var State = declare(null, {
            constructor: function(data) {
                this.regionConfig = $.parseJSON(RegionConfig);
                this.savedState = _.defaults({}, data, {
                    region: this.regionConfig.globalRegion,
                    slrIdx: 0
                });
            },

            getState: function() {
                console.log(this.savedState)
                return this.savedState;
            },

            setRegion: function(region) {
                return this.clone({
                    region: region
                });
            },

            getRegion: function() {
                return this.savedState.region;
            },

            setSLRIdx: function(slrIdx) {

                console.log('setting slr', slrIdx)
                return this.clone({
                    slrIdx: slrIdx
                });
            },

            getSLRIdx: function() {
                return this.savedState.slrIdx;
            },

            // Return new State combined with `data`.
            clone: function(data) {
                return new State(_.assign({}, this.getState(), data));
            }
        });

        return State;
    }
);
