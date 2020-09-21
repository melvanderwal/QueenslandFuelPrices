// Cookie which stores the user's preferences and last-used map location
class CookieManager {
    setMapLocation() {
        this.set("center", JSON.stringify(map.getCenter()));
        this.set("zoom", map.getZoom());
    }

    getMapLocation() {
        return {
            "zoom": this.get("zoom"),
            "center": JSON.parse(this.get("center"))
        }
    }

    setFuelTypes() {
        this.set("fuelTypes", JSON.stringify(priceData.fuelTypes));
    }

    getFuelTypes() {
        return JSON.parse(this.get("fuelTypes"));
    }



    // Parse a cookie for the provided parameter name
    get(parameterName) {
        let parameterReplace = parameterName + "=";
        let parameters = document.cookie.split(";");
        for (let index = 0; index < parameters.length; index++) {
            const parameter = parameters[index].trim();
            if ((parameter).indexOf(parameterReplace) == 0)
                return parameter.substring(parameterReplace.length, parameter.length);
        }
        return null;
    }

    // Sets a cookie, expiring in 60 days
    set(key, value) {
        var cookie = key + "=" + value + ";";
        cookie += "max-age=" + 60 * 60 * 24 * 60 + ";";
        cookie += "SameSite=None;Secure;";
        document.cookie = cookie;
    }
}

var cookie = new CookieManager();
