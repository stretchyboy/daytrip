import jQuery from 'jquery';
import "bootstrap/dist/css/bootstrap.css";

jQuery.getJSON("eh/ehAjax/NM_Ajax/GetDataForMap.ashx?category=Property",
    function (data) {
        var aSites = [];
        for (var sRegion in data.Region) {
            for (var sArea in data.Region[sRegion]) {
                aSites = aSites.concat(data.Region[sRegion][sArea].properties);
            }
        }
        console.log("aSites", aSites);
    });
