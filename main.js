var cacheFactory = require('node-http-cache');
 
// (...)
 
var config = {
    location: '/tmp',
    //List of services
    services:[{
        //Update every day at 00:00
        cronExpression: '0 0 * * *',
        name: 'cities',
        timezone: 'America/Buenos_Aires',
        httpOptions:{
            url: 'http://www.english-heritage.org.uk/ehAjax/NM_Ajax/GetDataForMap.ashx?category=Property&theme=&page=1&place=&itemid=664',
            headers: {
                'accept':'application/json'
            }
        },
        indexes: ['countrycode']
    }]
};
 
// (...)
 
var cache = cacheFactory(config);
 
// (...)
 
// Retrieves all cities
var allCities = cache.get(
  {
    name: 'cities'
  }
);
var onlyMXCities = cache.get(
  {
      name: 'cities', 
      indexKey: 'countrycode',
      indexValue: 'MX'
); 