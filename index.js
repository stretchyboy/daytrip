var fs = require("fs");
var httpAdapter = 'http';
var moment = require("moment");

var oEH = JSON.parse(fs.readFileSync("eh.json").toString());


var ArgumentParser = require('argparse').ArgumentParser;

var parser = new ArgumentParser({
  version: '0.0.1',
  addHelp:true,
  description: 'Day trip lister'
});

parser.addArgument(
  [ '-p', '--postcode' ],
  {
    help: "Post Code",
    defaultValue: "S6 5QL",
    dest:"sPostcode"
  }
);

parser.addArgument(
  [ '-m', '--maxmiles' ],
  {
    help: "Maximum Miles",
    defaultValue: 100,
    dest:"iMaxMiles"
  }
);

parser.addArgument(
  [ '-t', '--maxtimes' ],
  {
    help: "Maximum Time in Minutes",
    defaultValue: 180,
    dest:"iMaxTime"
  }
);

parser.addArgument(
  [ '-c', '--maxcalls' ],
  {
    help: "Maximum number of Calls in a run",
    defaultValue: 180,
    dest:"iMaxCalls"
  }
);


parser.addArgument(
  [ '-g', '--geocoder' ],
  {
    help: "Geocoder Provider",
    defaultValue: "google",
    dest:"geocoderProvider"
  }
);

parser.addArgument(
  [ '-j', '--journeycall' ],
  {
    help: "Make the Journey planning calls",
    action: 'storeTrue',
    defaultValue: false,
    dest:"bJourneyCalls"
  }
);


parser.addArgument(
  [ '-d', '--debug' ],
  {
    help: "Turn debugging on",
    action: 'storeTrue',
    defaultValue: false,
    dest:"bDebug"
  }
);

var options = parser.parseArgs();
//console.log("options =", options);

var geocoderProvider = options.geocoderProvider;//'google';
var geocoder = require('node-geocoder')(geocoderProvider, httpAdapter);//, extra);

var sPostcode = options.sPostcode;//"S6 5QL";
var iMaxMiles = options.iMaxMiles;//100;
var iMaxTime = options.iMaxTime;//180;
var iMaxCalls = options.iMaxCalls;//10;

var bJourneyCalls = options.bJourneyCalls;//false;
var bDebug = options.bDebug;//false;

var sCantLocateFile = "data/cant_locate_"+geocoderProvider+".json";
var sPostcodeJSON = "data/"+sPostcode+".json";
var iCalls = 0;

var aCantLocate = [];
if(fs.existsSync(sCantLocateFile)) {
  aCantLocate = JSON.parse(fs.readFileSync(sCantLocateFile).toString());
}
//console.log("aCantLocate =", aCantLocate);

var aTooFar = [];
var sTooFarFile = "data/too_far_"+sPostcode+".json";
if(fs.existsSync(sTooFarFile)) {
  aTooFar = JSON.parse(fs.readFileSync(sTooFarFile).toString());
}
//console.log("aTooFar =", aTooFar);

var oTransportAPI = JSON.parse(fs.readFileSync("transportapi.json").toString());


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

var oPostCode;

if(fs.existsSync(sPostcodeJSON)) {
  oPostCode = JSON.parse(fs.readFileSync(sPostcodeJSON).toString());
} else {
  geocoder.geocode(sPostcode, function(err, oPostCodeRes) {
      oPostCode = oPostCodeRes[0] ;//.longitude+","+oPostCodeRes[0].latitude;
      fs.writeFileSync(sPostcodeJSON, JSON.stringify(oPostCode, null, 4)); 
  });
}

var sRegion = "";
var aProperties = oEH.results.map(function(oProperty){
   if (oProperty.region && !oProperty["name/_text"]) {
     sRegion = oProperty.region;
   } else {
     oProperty.region = sRegion;
     oProperty.search = oProperty["name/_text"]+", "+oProperty.region;
     oProperty.filefrag = (oProperty["name/_text"]+"_"+oProperty.region).replace(" ","_");
   }
   return oProperty;
});

aProperties = aProperties.filter(function(oProperty){
   if (oProperty.region && !oProperty["name/_text"]) {
     return false;
   }
   return true;
});



aProperties = aProperties.filter(function(oProperty){
   if (typeof oProperty.condition !== "undefined")
    if(oProperty.condition === "Ruins") {
     return false;
   }
   
   if(aCantLocate.indexOf(oProperty.search) !== -1){
     return false;
   }
   
   if(aTooFar.indexOf(oProperty.search) !== -1){
     return false;
   }
   
   return true;
   if(oProperty["type/_text"] === "Castle" 
     || oProperty["type/_text"] === "Village"
     || oProperty["type/_text"] === "Country House"
     || oProperty["type/_title"] === "Castra"
     ) {
     return true;
   }
   return false;
});

console.log("aProperties =", aProperties.length);
//aProperties = aProperties.slice(0,15); 
//if (bDebug) {console.log("aProperties =", aProperties);}



var sDateFrag = "/by/"+moment().endOf('week').add(2, "day").hour(12).minute(0).format("YYYY-MM-DD/hh:mm");

// Using callback 
aProperties.forEach(function(oProperty) {
  if (bDebug) {console.log("Looking for Property", oProperty.search);}
  var sFileName = "journey_plans/"+(sPostcode).replace(/[\/\:\+\,]/g,"_")+"_"+oProperty.filefrag+".json"; 
  if(fs.existsSync(sFileName)) {
      var oResponce = JSON.parse(fs.readFileSync(sFileName).toString());
      if (bDebug) {console.log("From File "+sFileName);}
      displayJourney(oProperty, false, oResponce);
  } else if (iCalls < iMaxCalls) {    
    iCalls ++;
    
    geocoder.geocode(oProperty.search.replace("&", " "), function(err, res) {
      
      //Do the journey plan
      var sURLBase = "http://transportapi.com/v3/uk/public/journey/";
      var sAppCredintials = ".json?region=southeast&api_key="+oTransportAPI.api_key+"&app_id="+oTransportAPI.app_id;
      if(res.length === 0) {
        console.log("Can't Find Geo Location for Property", oProperty.search);
        
        aCantLocate.push(oProperty.search);
        //console.log("aCantLocate =", aCantLocate);
        fs.writeFileSync(sCantLocateFile, JSON.stringify(aCantLocate, null, 4));
      } else {
        if(typeof res.raw !== "undefined" && typeof res.raw.error_message  !== "undefined") {
          console.log(res.raw.error_message);
        } else {
          var iDist = distance(oPostCode.latitude, oPostCode.longitude, res[0].latitude, res[0].longitude, "M");
          
          //console.log("iDist =", iDist);
          if(iDist < iMaxMiles) {
            if(bJourneyCalls) {
              console.log("Looking up Journey to ", oProperty.search);
              var sFrom = "from/postcode:"+sPostcode.replace("", "+");
              var sTo = "/to/lonlat:"+res[0].longitude+","+res[0].latitude;
              var sURL = sURLBase+sFrom+sTo+sDateFrag+sAppCredintials;
              if (bDebug) {console.log("sURL =", sURL);}
              if (bDebug) {console.log("Saving to File "+sFileName);}
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
                      fs.writeFileSync(sFileName, str);
                      console.log("Saved to ",sFileName);
                      displayJourney(oProperty, res[0], oResponce);
                    }
                  });
                } else {
                  console.log("response.statusCode =", response.statusCode);
                }
                
                response.on('error', function(e) {
                  console.log("Got error: " + e.message);
                });
              });
            } else {
              iCalls --; //not sure this will work
            }
          } else {
            aTooFar.push(oProperty.search);
            console.log(oProperty.search+" is too far at ", iDist);
            //console.log("aTooFar =", aTooFar);
            fs.writeFileSync(sTooFarFile, JSON.stringify(aTooFar, null, 4));
          }
        }
      }
    });
  }
});


function displayJourney(oProperty, oLocation, oJourney){
  if(oJourney.routes.length > 0) {
    var aDurations = oJourney.routes.map(function(oRoute){
        return oRoute.duration;
    });
    var aSorted = aDurations.sort();
    var aDur = aSorted[0].split(":");
    var iMins = (parseInt(aDur[0])*60) + parseInt(aDur[1]);
    if(iMins < iMaxTime) {
      console.log(oProperty.search+ " takes " + aDurations.join(", "));
    }
  } else {
    if(bDebug) {console.log("No Journey to "+oProperty.search);}
  }
}
  
