class mapboxControls {
    constructor() {
        this.fullscreen = new mapboxgl.FullscreenControl();
        this.geolocate = new mapboxgl.GeolocateControl({
            positionOptions: { enableHighAccuracy: true },
            fitBoundsOptions: { maxZoom: 13 },
            showAccuracyCircle: false
        });
        this.attribution = new mapboxgl.AttributionControl({
            compact: true,
            customAttribution: "Fuel prices provided by Queensland Government"
        })
        this.settings = new SettingsControl();
        this.priceRange = new PriceRangeControl();
    }
}


class SettingsControl {
    onAdd(map) {
        this._map = map;
        this._container = document.createElement('div');
        this._container.className = 'mapboxgl-ctrl';
        let templateNode = document.getElementById("settingsControl").cloneNode(true);
        this._container.innerHTML = templateNode.innerHTML;
        return this._container;
    }

    onRemove() {
        this._container.parentNode.removeChild(this._container);
        this._map = undefined;
    }
}

class PriceRangeControl {
    onAdd(map) {
        this._map = map;
        this._container = document.createElement('div');
        this._container.className = 'mapboxgl-ctrl';
        let templateNode = document.getElementById("priceRangeControl").cloneNode(true);
        this._container.innerHTML = templateNode.innerHTML;

        this.priceRangeDiv = this._container;
        this.priceRangeSlider = this.priceRangeDiv.querySelector("#priceRangeSlider");
        this.priceRangeThumbIcon = this.priceRangeDiv.querySelector("#priceRangeThumbIcon");
        this.bottomRangeMain = this.priceRangeDiv.querySelector("#bottomRangePrice");
        this.bottomRangeDecimal = this.priceRangeDiv.querySelector("#bottomRangeDecimal");
        this.topRangeMain = this.priceRangeDiv.querySelector("#topRangePrice");
        this.topRangeDecimal = this.priceRangeDiv.querySelector("#topRangeDecimal");
        this.bottomSiteLabel = this.priceRangeDiv.getElementsByClassName("bottomSiteLabel")[0];
        this.topSiteLabel = this.priceRangeDiv.getElementsByClassName("topSiteLabel")[0];
        this.siteNameLabel = this.priceRangeDiv.querySelector('#pricesPopupSiteName');
        this.lastUpdatedLabel = this.priceRangeDiv.querySelector('#pricesPopupLastUpdated');
        this.comparedFuelsList = this.priceRangeDiv.querySelector('#pricesPopupComparedLines');
        this.displayedFuelsList = this.priceRangeDiv.querySelector('#pricesPopupDisplayedLines');
        this.rangeData = {
            min: null, max: null, current: null, minSite: null, maxSite: null, currentSite: null,
            currentSiteLastUpdated: null, currentSitePrices: null, thumbStepCount: 1
        };
        return this._container;
    }

    onRemove() {
        this._container.parentNode.removeChild(this._container);
        this._map = undefined;
    }

    update() {
        let data = this.rangeData;

        // Set thumb visibility and value.  Round values to 2 decimal places so increments of 0.01 can be compared.
        this.priceRangeSlider.classList.replace("noRangeThumb", "rangeThumb");
        if (data.current && data.min != data.max) {
            let targetPosition = Math.round((this.overPricing() + Number.EPSILON) * 100) / 100;
            let currentPosition = Math.round((parseFloat(this.priceRangeSlider.value) + Number.EPSILON) * 100) / 100;

            // Just jiggle the thumb icon if the price is unchanged
            if (targetPosition == currentPosition && data.current >= data.min && data.current <= data.max) {
                this.priceRangeThumbIcon.className = "fas fa-gas-pump fa-lg animated wobble";
                setTimeout(() => {
                    this.priceRangeThumbIcon.className = "fas fa-gas-pump fa-lg";
                }, 700)
            }

            // Move the thumb to the new price
            else {
                this.priceRangeThumbIcon.className = "fas fa-gas-pump fa-lg rangeThumb";
                this.moveThumb(targetPosition);
            }
        }
        else {
            this.priceRangeThumbIcon.className = "noRangeThumb";
            this.priceRangeSlider.classList.replace("rangeThumb", "noRangeThumb");
        }

        // Set range min/max labels
        let topPrice = this.getPriceParts(data.max);
        let bottomPrice = this.getPriceParts(data.min);
        this.topRangeMain.dataset.value = data.min == data.max ? "" : topPrice.dollars;
        this.topRangeDecimal.dataset.value = data.min == data.max ? "" : topPrice.tenths;
        this.topSiteLabel.dataset.value = data.min == data.max ? "" : data.maxSite;
        this.bottomRangeMain.dataset.value = !data.min ? "" : bottomPrice.dollars;
        this.bottomRangeDecimal.dataset.value = !data.min ? "" : bottomPrice.tenths;
        this.bottomSiteLabel.dataset.value = !data.minSite ? "" : data.minSite;

        // Set current site labels
        this.comparedFuelsList.innerHTML = "";
        this.displayedFuelsList.innerHTML = "";

        if (!data.currentSite) {
            this.siteNameLabel.dataset.value = "";
            this.lastUpdatedLabel.dataset.value = "";
        }
        else {
            this.siteNameLabel.dataset.value = data.currentSite;

            let lastUpdated = "";
            if (data.currentSiteLastUpdated) {
                let dateOptions = {
                    weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: 'numeric',
                    timeZone: 'Australia/Brisbane'
                };
                lastUpdated = "Prices Since: " + new Intl.DateTimeFormat('en-AU', dateOptions).format(new Date(data.currentSiteLastUpdated));
            }
            this.lastUpdatedLabel.dataset.value = lastUpdated;

            // Populate price list
            let prices = data.currentSitePrices;
            let priceTypes = [priceData.fuelTypes.compared, priceData.fuelTypes.displayed];
            for (let typeIndex = 0; typeIndex < priceTypes.length; typeIndex++) {
                let fuelTypes = priceTypes[typeIndex];
                for (let index = 0; index < fuelTypes.length; index++) {
                    let fuelType = fuelTypes[index];
                    if (data.currentSitePrices.has(fuelType)) {
                        let price = data.currentSitePrices.get(fuelType);
                        this.addLine(
                            typeIndex == 0 ? true : false,
                            price,
                            fuelType,
                            (price == data.current && priceData.fuelTypes.compared.includes(fuelType) && data.min != null) ? priceColor(this.overPricing()) : null
                        );
                    }
                }
            }
        }
    }

    overPricing() {
        if (this.rangeData.current <= this.rangeData.min) return 0;
        if (this.rangeData.current >= this.rangeData.max) return 1;
        return (this.rangeData.current - this.rangeData.min) / (this.rangeData.max - this.rangeData.min);
    }

    // Provides price strings, separated by dollar/cents and tenths of a cent
    getPriceParts(price) {
        let priceText = "$" + (price / 100).toFixed(3);
        var priceParts = {};
        priceParts.dollars = priceText.substring(0, priceText.length - 1);
        priceParts.tenths = priceText.substring(priceText.length - 1, priceText.length);
        return priceParts;
    }

    // Moves the slider thumb to its new value (between 0 and 1) by 0.01 increments.
    moveThumb(percentFromBottom) {
        // If the range is at the target value, set its icon and exit
        let startVal = parseFloat(this.priceRangeSlider.value);
        startVal = Math.round((startVal + Number.EPSILON) * 100) / 100;
        if (startVal == percentFromBottom) {
            this.priceRangeThumbIcon.className = this.thumbIconClass();
            return;
        }

        // Upate the thumb position
        let nextVal = startVal;
        if (startVal < percentFromBottom) nextVal = nextVal + 0.01;
        else nextVal = nextVal - 0.01;
        this.priceRangeSlider.value = nextVal;

        // Move thumb icon to sit on top of thumb, and set its color according to its new position
        let rangeOffsetTop = 7, thumbSize = 25, sliderHeight = this.priceRangeSlider.clientWidth, bottomPx = rangeOffsetTop + sliderHeight;
        let newTop = bottomPx - parseInt((thumbSize / 2) + ((sliderHeight - thumbSize) * nextVal));
        this.priceRangeThumbIcon.style.top = newTop + "px";
        this.priceRangeThumbIcon.style.color = priceColor(nextVal);

        // Start the loop again                
        setTimeout(() => {
            this.moveThumb(percentFromBottom);
        }, 15)
    }

    // The icons to be used when the thumb has finished moving to its new position
    thumbIconClass() {
        if (this.rangeData.current < this.rangeData.min) return "fas fa-hand-point-down fa-lg animated rubberBand infinite";
        if (this.rangeData.current > this.rangeData.max) return "fas fa-hand-point-up fa-lg animated rubberBand infinite";
        return "fas fa-gas-pump fa-lg animated swing";
    }

    // Adds a line to the current site's fuel prices
    addLine(compared, price, fuelType, priceColor) {
        let priceParts = this.getPriceParts(price);
        let clone = document.querySelector('#pricePopupLineTemplate').content.cloneNode(true);
        let template = clone.querySelector('div');
        template.getElementsByClassName('valueLabel')[0].dataset.value = priceParts.dollars;
        template.getElementsByClassName('valueLabel')[1].dataset.value = priceParts.tenths;
        template.getElementsByClassName('valueLabel')[2].dataset.value = fuelType;
        if (priceColor != null) {
            template.getElementsByClassName('valueLabel')[0].style.color = priceColor;
            template.getElementsByClassName('valueLabel')[1].style.color = priceColor;
        }

        if (compared == true)
            this.comparedFuelsList.appendChild(template);
        else
            this.displayedFuelsList.appendChild(template);
    }
}
