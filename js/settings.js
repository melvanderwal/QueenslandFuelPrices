// Color lookup
let colors = new Map();
colors.set("Premium Unleaded 98", "red");
colors.set("Premium Unleaded 95", "blue");
colors.set("Unleaded", "yellow");
colors.set("e10/Unleaded", "green");
colors.set("e10", "green");
colors.set("Diesel/Premium Diesel", "black");
colors.set("Premium Diesel", "black");
colors.set("Diesel", "black");


const comparedNode = document.getElementById("compared");
const displayedNode = document.getElementById("displayed");
const hiddenNode = document.getElementById("hidden");

// Populates the sortable lists from the priceData.fuelTypes JSON data using a html template
function populateLists() {

    function addItem(listElement, fuel) {
        let clone = document.querySelector('#fuelItemTemplate').content.cloneNode(true);
        let template = clone.querySelector('#fuelItem');
        template.getElementsByClassName('fas fa-gas-pump')[0].style.color = colors.has(fuel) ? colors.get(fuel) : "darkgrey";
        template.getElementsByClassName('fuelId')[0].dataset.fuelType = fuel;
        template.getElementsByClassName('fuelId')[0].innerText = fuel;
        listElement.appendChild(template);
    }

    comparedNode.textContent = '';
    for (let index = 0; index < priceData.fuelTypes.compared.length; index++) {
        const fuel = priceData.fuelTypes.compared[index];
        addItem(comparedNode, fuel);
    }

    displayedNode.textContent = '';
    for (let index = 0; index < priceData.fuelTypes.displayed.length; index++) {
        const fuel = priceData.fuelTypes.displayed[index];
        addItem(displayedNode, fuel);
    }

    hiddenNode.textContent = '';
    for (let index = 0; index < priceData.fuelTypes.hidden.length; index++) {
        const fuel = priceData.fuelTypes.hidden[index];
        addItem(hiddenNode, fuel);
    }
}

// Stores the user-defined order of fuels into an object and saves a cookie
function storeLists() {
    priceData.fuelTypes.compared = [];
    var listItems = comparedNode.getElementsByClassName("fuelId");
    for (let index = 0; index < listItems.length; index++) { priceData.fuelTypes.compared.push(listItems[index].dataset.fuelType); }

    priceData.fuelTypes.displayed = [];
    var listItems = displayedNode.getElementsByClassName("fuelId");
    for (let index = 0; index < listItems.length; index++) { priceData.fuelTypes.displayed.push(listItems[index].dataset.fuelType); }

    priceData.fuelTypes.hidden = [];
    var listItems = hiddenNode.getElementsByClassName("fuelId");
    for (let index = 0; index < listItems.length; index++) { priceData.fuelTypes.hidden.push(listItems[index].dataset.fuelType); }

    cookie.setFuelTypes();
}

// Sortable list properties
var comparedList = new Sortable(compared, {
    group: {
        name: 'fuels',
        pull: function (to, from) {
            return from.el.children.length > 1;
        }
    },
    onEnd: listChanged,
    animation: 300
});

var displayedList = new Sortable(displayed, {
    group: 'fuels',
    onEnd: listChanged,
    animation: 300
});

var hiddenList = new Sortable(hidden, {
    group: 'fuels',
    onEnd: listChanged,
    animation: 300
});

function listChanged(evt) {
    if (evt.from.id == "compared" || evt.to.id == "compared") {
        storeLists();
        updateMarkers()
    }
}


// Modal settings popup
document.getElementById("openSettingsButton").onclick = function () {
    populateLists();
    document.getElementById("modalSettingsMain").classList.add('model-open');
};

document.getElementById("modalSettingsCloseBtn").onclick = function () {
    storeLists()
    document.getElementById("modalSettingsMain").classList.remove('model-open');
};

document.getElementById("modalSettingsBg").onclick = function () {
    storeLists();
    document.getElementById("modalSettingsMain").classList.remove('model-open');
};
