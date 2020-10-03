// The title can be hidden when embedded in the MelStuff page
var urlParams = new URLSearchParams(window.location.search);
if (urlParams.has("title"))
    if (urlParams.get("title") == "false") document.getElementById("titleBar").style.display = "none";

mapboxgl.accessToken = "pk.eyJ1IjoibWVsdmFuZGVyd2FsIiwiYSI6ImNrZGt5NnZzbTA1MWQyc2tiMmdjOHdzamoifQ.ygz_QyPDlrstuvm-iI-W1Q";

// Get startup map location from cookie; use defaults if there is no cookie
var startLocation = cookie.getMapLocation();
if (startLocation.center == null) startLocation.center = [152.920512, -27.297468];
if (startLocation.zoom == null) startLocation.zoom = 8;

var map = new mapboxgl.Map({
    container: "map",
    style: "mapbox://styles/melvanderwal/ckdr2rdye0kp219jzcq4z0gcr",
    center: startLocation.center,
    zoom: startLocation.zoom,
    attributionControl: false
});

// Add controls to the map.    
var controls = new mapboxControls();
map.addControl(controls.priceRange, "top-left");
map.addControl(controls.settings, "top-left");
map.addControl(controls.fullscreen, "top-right");
map.addControl(controls.geolocate, "top-right");
map.addControl(controls.attribution, "bottom-right");

// Make the Settings popup a child of the map element, or it won't work in fullscreen
document.getElementById("map").appendChild(document.getElementById("modalSettingsMain"));

/* 
Pricing update code
Prices GeoJSON comes from server API.
Price comparisons are refreshed to reflect only what is on the user's screen.
*/
class fuelPriceData {
    constructor(sourceGeoJson) {
        this.sourcePrices = sourceGeoJson;
        this.filteredPrices = null;
        this.fuelTypes = null;
        this.minPrice = null;
        this.maxPrice = null;
        this.minPriceSite = null;
        this.maxPriceSite = null;

        // Get fuel types from the document cookie, or create them with default values if necessary
        this.fuelTypes = cookie.getFuelTypes();
        if (!this.fuelTypes || !this.fuelTypes.compared || !this.fuelTypes.displayed || !this.fuelTypes.hidden) {
            this.fuelTypes = {
                'compared': ['Unleaded', 'e10/Unleaded', 'e10'],
                'displayed': ['Premium Unleaded 98', 'Premium Unleaded 95', 'Diesel/Premium Diesel', 'Premium Diesel', 'Diesel'],
                'hidden': ['LPG', 'Premium e5', 'Bio-Diesel 20', 'e85', 'ULSD', 'LRP', 'OPAL', 'Compressed natural gas', 'Liquefied natural gas']
            }
            cookie.setFuelTypes();
        }
    }   // End constructor

    // Create a subset of the data only containing the features currently in view.
    // Populate the price property if that site sells the currently selected fuel type.
    filterPrices() {
        let fuelTypes = this.fuelTypes.compared;
        this.minPrice = 10000;
        this.maxPrice = 0;
        this.minPriceSite = "";
        this.maxPriceSite = "";
        this.filteredPrices = { "type": "FeatureCollection", "features": [] };

        // Only add features if map is zoomed in far enough

        for (let index = 0; index < this.sourcePrices.features.length; index++) {
            let feature = this.sourcePrices.features[index];

            // Get the cheapest of the fuel types to be compared
            let price = null;
            for (let index = 0; index < fuelTypes.length; index++) {
                const fuelType = fuelTypes[index];
                const checkPrice = feature.properties.Prices[fuelType];
                if (checkPrice && (!price || checkPrice < price))
                    price = checkPrice;
            }

            if (map.getBounds().contains(feature.geometry.coordinates)) {
                let newFeature = JSON.parse(JSON.stringify(feature));  // Clone feature
                this.filteredPrices.features.push(newFeature);
                if (price) {
                    newFeature.properties.Price = price;
                    if (price < this.minPrice) {
                        this.minPrice = price;
                        this.minPriceSite = newFeature.properties.Name;
                    }
                    if (price > this.maxPrice) {
                        this.maxPrice = price;
                        this.maxPriceSite = newFeature.properties.Name;
                    }
                }
            }
        }

        this.rangeData = {
            min: null, max: null, current: null, minSite: null, maxSite: null, currentSite: null,
            currentSiteLastUpdated: null, currentSitePrices: null, thumbStepCount: 1
        };

        // Update the price range control
        let data = controls.priceRange.rangeData;
        if (this.filteredPrices.features.length == 0 || this.minPrice == 10000) {
            data.min = null;
            data.max = null;
            data.minSite = null;
            data.maxSite = null;
        }
        else {
            data.min = this.minPrice;
            data.max = this.maxPrice;
            data.minSite = this.minPriceSite;
            data.maxSite = this.maxPriceSite;
        }

        // Add a overpricing index to each feature, ranking it for price compared to all other features.
        // Add a property indicating which marker this feature should use.
        // Add a marker for each feature.
        for (let index = 0; index < this.filteredPrices.features.length; index++) {
            let feature = this.filteredPrices.features[index];
            let price = feature.properties.Price;
            if (!price)
                feature.properties.Marker = "notCarried";
            else {
                let overPricing = (this.maxPrice == this.minPrice) ? 0 : (price - this.minPrice) / (this.maxPrice - this.minPrice);
                let color = priceColor(overPricing);
                feature.properties.Overpricing = overPricing;
                feature.properties.PriceColor = color;
                if (price == this.minPrice)
                    feature.properties.Marker = "cheapest";
                else if (price == this.maxPrice)
                    feature.properties.Marker = "mostExpensive";
                else if (overPricing < 0.25)
                    feature.properties.Marker = "cheap";
                else if (overPricing < 0.75)
                    feature.properties.Marker = "average";
                else if (overPricing < 1)
                    feature.properties.Marker = "expensive";
            }
        }

        map.getSource('priceSource').setData(priceData.filteredPrices);
    }   // End filterPrices
} // End class

var priceData = null;       // fuelPriceData object to be populated when the map loads
var priceMarkers = [];      // Array holding the markers drawn on the user's screen

map.on('zoomend', updateMarkers);
map.on('dragend', updateMarkers);

function updateMarkers() {
    // Clear existing markers from the map and reset array that holds them
    for (let index = 0; index < priceMarkers.length; index++) {
        priceMarkers[index].remove();
    }
    priceMarkers = [];

    if (!priceData) return;
    priceData.filterPrices();

    // Only display markers if the filtered prices layer is visible
    if (map.getZoom() >= map.getLayer('pricePointLayer').minzoom) {
        // Style markers according to how expensive the price is.
        const markerDivs = document.getElementById("symbology").content.cloneNode(true);
        for (let index = 0; index < priceData.filteredPrices.features.length; index++) {
            let feature = priceData.filteredPrices.features[index];

            const markerDiv = markerDivs.querySelector('#' + feature.properties.Marker).cloneNode(true);
            if (feature.properties.Marker !== "notCarried")
                markerDiv.style.color = feature.properties.PriceColor;

            const priceMarker = new mapboxgl.Marker({ element: markerDiv })
                .setLngLat(feature.geometry.coordinates)
                .addTo(map);

            priceMarkers.push(priceMarker);
        }
    }

    controls.priceRange.update();
    cookie.setMapLocation();
}

// Returns the color that is x% between one color and another
function priceColor(percentage) {
    let rgbStart = [50, 255, 50];
    let rgbEnd = [255, 50, 50];
    let newRgb = [];
    for (let index = 0; index < 3; index++) {
        let startVal = rgbStart[index];
        let endVal = rgbEnd[index];
        let newVal = ((endVal - startVal) * percentage) + startVal;
        newRgb.push(newVal);
    }
    return "rgb(" + parseInt(newRgb[0]) + "," + parseInt(newRgb[1]) + "," + parseInt(newRgb[2]) + ")";;
}



// Add data sources and layers to the map
map.on("load", function () {

        priceData = new fuelPriceData(data);

        var priceSource = {
            "type": "geojson",
            "data": priceData.filteredPrices
        };
        map.addSource('priceSource', priceSource);

        var allPricesSource = {
            "type": "geojson",
            "data": priceData.sourcePrices
        };
        map.addSource('allPricesSource', allPricesSource);

        const layers = map.getStyle().layers;
        var firstSymbolId;
        for (let i = 0; i < layers.length; i++) {
            if (layers[i].type === 'symbol') {
                firstSymbolId = layers[i].id;
                break;
            }
        }

        map.addLayer({
            'id': 'priceHeatLayer',
            'source': 'allPricesSource',
            'type': 'heatmap',
            'paint': { 'heatmap-opacity': 0.1 }
        }, firstSymbolId)

        // The price points layer isn't used visually, but is used when the user clicks on a marker to get
        // the data for that petrol station.
        map.addLayer({
            'id': 'pricePointLayer',
            'source': 'priceSource',
            'minzoom': 11,
            'type': 'circle',
            'paint': { "circle-opacity": 0, "circle-radius": 15 }
        })

        map.on('click', 'pricePointLayer', function (e) {
            // Fix null values - e.features changes null to a string "null"
            let props = e.features[0].properties;

            let keys = Object.keys(props);
            let vals = Object.values(props);
            vals.forEach(function (item, i) { if (item == "null") props[keys[i]] = null; });

            // Update the price range control
            let data = controls.priceRange.rangeData;

            data.current = props.Price;
            data.currentSite = props.Name;
            data.currentSiteLastUpdated = props.LastUpdatedUtc;

            let prices = JSON.parse(props.Prices);
            data.currentSitePrices = new Map();
            keys = Object.keys(prices);
            vals = Object.values(prices);
            vals.forEach(function (item, i) { data.currentSitePrices.set(keys[i], vals[i]) });

            controls.priceRange.update();
        });

        updateMarkers();

        // Hide the startup spinner
        document.getElementById("kickstart").style.display = "none";

})  // End Map on load

