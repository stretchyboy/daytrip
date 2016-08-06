var fs = require("fs");
var httpAdapter = 'http';
var moment = require("moment");

//File from import.io screen scraper
var FileName = "English Heritage Properties.json";
var oEH = JSON.parse(fs.readFileSync(FileName).toString());

var ArgumentParser = require('argparse').ArgumentParser;

var parser = new ArgumentParser({
  version: '0.0.1',
  addHelp:true,
  description: 'Day trip lister'
});

parser.addArgument(  [ '-p', '--postcode' ],
  { help: "Post Code to search around", defaultValue: "S6 5QL" });
parser.addArgument(  [ '--ruins' ],
  { help: "Include Ruins in search results", action: 'storeTrue', defaultValue: false });
parser.addArgument(  [ '-r', '--radius' ],
  { help: "Maximum as crow flies distance in Miles", defaultValue: 50 });
parser.addArgument(  [ '-n', '--nojourneycalls' ],
  { help: "Don't make any Journey planning calls", action: 'storeTrue', defaultValue: false});
parser.addArgument(  [ '-t', '--maxtime' ],
  { help: "Maximum Journey Time in Minutes", defaultValue: 120});
parser.addArgument(  [ '-l', '--maxlcalls' ],
  { help: "Maximum number of Location Calls in a run", defaultValue: 10});
parser.addArgument(  [ '-x', '--maxjcalls' ],
  { help: "Maximum number of Journey Calls in a run", defaultValue: 50});
parser.addArgument(  [ '--hour' ],
  { help: "Target hour of the day", defaultValue: 12});
  parser.addArgument(  [ '-a', '--tapi' ],
  { help: "Transport API Credentials to use", defaultValue: "default"});
parser.addArgument(  [ '-g', '--geocoder' ],
  { help: "Geocoder Provider (google / openstreetmap)", defaultValue: "google"});
parser.addArgument(  [ '-s', '--summary' ],
  { help: "Show summary of the Routes found", action: 'storeTrue', defaultValue: false });
parser.addArgument(  [ '-d','--debug' ],
  { help: "Turn debugging on", action: 'storeTrue', defaultValue: false});

var options = parser.parseArgs();
//console.log(options);
//process.exit();

var geocoderProvider = options.geocoder;//'google';
var geocoder = require('node-geocoder')(geocoderProvider, httpAdapter);//, extra);

function safeBaseName(Path){
  return Path.replace(/[\/\:\+\,\s\t]/g,"_");
}

var sCantLocateFile = ("data/cant_locate_"+geocoderProvider+".json");
var sLocationsFile = ("data/locations.json");
var sPostcodeJSON = ("data/"+safeBaseName(options.postcode)+".json");
var iCalls = 0;
var iJCalls = 0;        

if(!fs.existsSync("data/")) {
  fs.mkdirSync("data/");
}

if(!fs.existsSync("journey_plans/")) {
  fs.mkdirSync("journey_plans/");
}

if(!fs.existsSync("journey_summaries/")) {
  fs.mkdirSync("journey_summaries/");
}

var aCantLocate = [];
if(fs.existsSync(sCantLocateFile)) {
  aCantLocate = JSON.parse(fs.readFileSync(sCantLocateFile).toString());
}

var oLocations = {};
if(fs.existsSync(sLocationsFile)) {
  oLocations = JSON.parse(fs.readFileSync(sLocationsFile).toString());
}

var oTransportAPIAll = JSON.parse(fs.readFileSync("transportapi.json").toString());
var oTransportAPI = oTransportAPIAll[options.tapi];

var sURLBase = "http://transportapi.com/v3/uk/public/journey/";
var sAppCredintials = ".json?region=southeast&api_key="+oTransportAPI.api_key+"&app_id="+oTransportAPI.app_id;

function distance(lat1, lon1, lat2, lon2, unit) {
    var radlat1 = Math.PI * lat1/180;
    var radlat2 = Math.PI * lat2/180;
    var radlon1 = Math.PI * lon1/180;
    var radlon2 = Math.PI * lon2/180;
    var theta = lon1-lon2;
    var radtheta = Math.PI * theta/180;
    var dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
    dist = Math.acos(dist);
    dist = dist * 180/Math.PI;
    dist = dist * 60 * 1.1515;
    if (unit=="K") { dist = dist * 1.609344 }
    if (unit=="N") { dist = dist * 0.8684 }
    return dist;
}

//Spread the Region Names across the Properties listed after the region subheading
var sRegion = "";
var aProperties = oEH.map(function(oProperty){
   if (oProperty.region && !oProperty["name/_text"]) {
     sRegion = oProperty.region;
   } else {
     oProperty.region = sRegion;
     oProperty.search = oProperty["name/_text"]+", "+oProperty.region;
     oProperty.filefrag = safeBaseName(oProperty["name/_text"]+"_"+oProperty.region);
      
     oProperty.oldfilefrag = (oProperty["name/_text"]+"_"+oProperty.region).replace(" ","_");
     //console.log( oProperty.filefrag);
   }
   return oProperty;
});

//Filter out the Region subheadings
aProperties = aProperties.filter(function(oProperty){
   if (oProperty.region && !oProperty["name/_text"]) {
     return false;
   }
   return true;
});

aProperties = aProperties.filter(function(oProperty){
   // Filter for ruins 
   if (!options.includeruins && typeof oProperty.condition !== "undefined") {
      if(oProperty.condition === "Ruins") {
        return false;
      }
   }
   //Filter out the Properties we can't Locate
   if(aCantLocate.indexOf(oProperty.search) !== -1){
     return false;
   }

   return true;
});

//console.log("Located properties that are within "+options.radius+" miles =", aProperties.length);

if(options.includeruins){
  console.log("Including ruins");
}


//Get the starting point Postcode data (inc lon/lat)
var oPostCode = null;
if(fs.existsSync(sPostcodeJSON)) {
  oPostCode = JSON.parse(fs.readFileSync(sPostcodeJSON).toString());
  onPostCode(oPostCode);
} else {
  geocoder.geocode(options.postcode, function(err, oPostCodeRes) {
      oPostCode = oPostCodeRes[0] ;//.longitude+","+oPostCodeRes[0].latitude;
      fs.writeFileSync(sPostcodeJSON, JSON.stringify(oPostCode, null, 4)); 
      onPostCode(oPostCode);
  });
}

function onPostCode(oPostCode){
  aProperties = aProperties.map(function(oProperty) {
    if(oLocations.hasOwnProperty(oProperty.search)){
      oProperty.latitude = oLocations[oProperty.search].latitude;
      oProperty.longitude = oLocations[oProperty.search].longitude;
      if(oPostCode !== null && oPostCode.hasOwnProperty("latitude")) {
        oProperty.distance = distance(oPostCode.latitude, oPostCode.longitude, oProperty.latitude, oProperty.longitude, "M");
      }
    }
    return oProperty;
  }).sort(function(a,b){
    if(!a.hasOwnProperty("distance") && !b.hasOwnProperty("distance")){
      return 0;
    }
    if(a.hasOwnProperty("distance") && !b.hasOwnProperty("distance")){
      return 1;
    }
    if(!a.hasOwnProperty("distance") && b.hasOwnProperty("distance")){
      return -1;
    }
    return a.distance - b.distance;  
  });

  // Using callback 
  aProperties.forEach(function(oProperty) {
    var sFileName = ("journey_plans/"+safeBaseName(options.postcode)+"_"+oProperty.filefrag+".json");
    /*var sOldFileName = ("journey_plans/"+safeBaseName(options.postcode)+"_"+oProperty.oldfilefrag+".json"); 
    
    if(fs.existsSync(sOldFileName)) {
      fs.renameSync(sOldFileName, sFileName);
    }*/
    
    //If we have a relevant journey plan
    if(fs.existsSync(sFileName)) {
        var oResponce = JSON.parse(fs.readFileSync(sFileName).toString());
        if (options.debug) {console.log("From File "+sFileName);}
        displayJourney(oProperty, false, oResponce, options.postcode);
    } else {
      
      if(oLocations.hasOwnProperty(oProperty.search)) {
        onLocation(oLocations[oProperty.search], oProperty);
      } else if (iCalls < options.maxlcalls) {     //Do we have to locate this Property?
        iCalls ++;
        // TODO : Map the distances / sort / filter
        // TODO : Geocoder call throttling
        
        if (options.debug) {console.log("Look up Geo Location for Property ", oProperty.search);}
        geocoder.geocode(oProperty.search.replace("&", " "), function(err, res) {      
          //Do the journey plan
          if(res.length === 0) {
            console.log("Can't Find Geo Location for Property", oProperty.search);
            aCantLocate.push(oProperty.search);
            fs.writeFileSync(sCantLocateFile, JSON.stringify(aCantLocate, null, 4));
          } else { // Got a responce
            if(typeof res.raw !== "undefined" && typeof res.raw.error_message  !== "undefined") {
              console.log("GeoCoder : "+res.raw.error_message );
              console.log("After "+ iCalls +" Calls");
            } else if (typeof oPostCode !== "undefined"){ // We have a Location and a start position
              oLocations[oProperty.search] = res[0];
              fs.writeFileSync(sLocationsFile, JSON.stringify(oLocations, null, 4));
              onLocation(res[0], oProperty);
            } else {
              console.log("Postcode "+" not found");
            }
          }
        });
      }
    }
  });

}

function onLocation(oLocation, oProperty){
  var iDist = 0;
  if(oProperty.hasOwnProperty("distance")){
    iDist = oProperty.distance;
  } else {
    iDist = distance(oPostCode.latitude, oPostCode.longitude, oLocation.latitude, oLocation.longitude, "M");
  }
          
  //console.log("iDist =", iDist);
  if(iDist < options.radius) {
    if(!options.nojourneycalls && iJCalls < options.maxjcalls) {
      iJCalls ++;
      console.log("Looking up Journey to ", oProperty.search);
      var sFrom = "from/postcode:"+options.postcode.replace("", "+");
      var sTo = "/to/lonlat:"+ oLocation.longitude+","+ oLocation.latitude;
      
      // TODO : journey Plans for 13:00 or saturday / sunday
      var sDateFrag = "/by/"+moment().endOf('week').add(2, "day").hour(options.hour).minute(0).format("YYYY-MM-DD/hh:mm");

      var sURL = sURLBase+sFrom+sTo+sDateFrag+sAppCredintials;
      if (options.debug) {console.log("sURL =", sURL);}
      if (options.debug) {console.log("Saving to File "+sFileName);}
      var http = require('http');
      http.get(sURL,  function(response) {
        var str = '';
        if(response.statusCode === 200) {
          //another chunk of data has been recieved, so append it to `str`
          response.on('data', function (chunk) {
            str += chunk;
          });
        
          //the whole response has been recieved, so we just print it out here
          response.on('end', function () {
            var oResponce = JSON.parse(str); 
            if(typeof oResponce.error !== "undefined") {
              console.log("Error ", oResponce.error);
            } else {
              
              var sFileName = ("journey_plans/"+safeBaseName(options.postcode)+"_"+oProperty.filefrag+".json"); 
              fs.writeFileSync(sFileName, JSON.stringify(oResponce, null, 4));
              console.log("Saved to ",sFileName);
              displayJourney(oProperty,  oLocation, oResponce, options.postcode);
            }
          });
        } else {
          console.log("response.statusCode =", response.statusCode);
        }
        
        response.on('error', function(e) {
          console.log("Got error: " + e.message);
        });
      });
    }
  }
}

function displayJourney(oProperty, oLocation, oJourney, sPostcode){
  if(oJourney.routes.length > 0) {
    var aDurations = oJourney.routes.filter(function(oRoute){
        return oRoute.route_parts[0].mode !== "taxi";
        }).map(function(oRoute){
        return oRoute.duration;
    });
    
    var aSorted = aDurations.sort();
    var aDur = aSorted[0].split(":");
    var iMins = (parseInt(aDur[0])*60) + parseInt(aDur[1]);
    if(iMins < options.maxtime) {
      
      var aNoTaxis = oJourney.routes.filter(function(oRoute){
        return oRoute.route_parts.every(function(oPart){
          return oPart.mode !== "taxi";
        });
      });
      
      var aTaxiDurations = oJourney.routes.map(function(oRoute){
        return oRoute.route_parts.reduce(function(previousValue , oPart){
          return previousValue + (oPart.mode == "taxi")?oPart.duration:0;
        });
      });
      
      /*if(aNoTaxis.length == 0){
        console.log("Only has Journies including Taxis");
        console.log(aTaxiDurations.join(",  "));
      }*/

      console.log(oProperty.search+ " ("+oProperty["type/_text"]+":"+Math.round(oProperty.distance)+" miles) takes " + aDurations[0]+ "-"+aDurations[aDurations.length - 1]);
      if(options.summary) {
        var sRoutesSummary = oJourney.routes.filter(function(oRoute){
          return oRoute.route_parts[0].mode !== "taxi";
        }).map(function(oRoute){
          return " "+oRoute.departure_time+"("+oRoute.duration.replace(/\:00$/,"")+") "+oRoute.route_parts.map(function(oPart){
            return oPart.mode+"("+oPart.duration.replace(/\:00$/,"")+")";
          }).join(", ");
        }).join("\n");
      
        console.log(sRoutesSummary);
      }
      
      var aRoutes = oJourney.routes.filter(function(oRoute){
        return oRoute.route_parts[0].mode !== "taxi";
      }).map(function(oRoute){
        oRoute.route_parts = oRoute.route_parts.map(function(oPart){
          delete oPart.coordinates;
          return oPart;
        });
        return oRoute;
      });
      var oSummary = new Object(oJourney);
      oSummary.routes = aRoutes;
      var sFileName = "journey_summaries/"+safeBaseName(sPostcode)+"_"+oProperty.filefrag+".json";
      fs.writeFileSync(sFileName, JSON.stringify(oSummary, null, 4));
    }
  } else {
    if(options.debug) {console.log("No Journey to "+oProperty.search);}
  }
}
  
