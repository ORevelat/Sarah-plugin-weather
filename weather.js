var words = require( './weather.json' );

exports.init = function() {
	console.log('\x1b[96mWeather plugin is initializing ... \x1b[0m');
};

exports.dispose  = function() {
	console.log('\x1b[96mWeather plugin is disposed ... \x1b[0m');
};

exports.action = function(data, next) {
	if ( data.mode && (data.mode == "WEATHER"))
		return actionWeather(data, next);

	commandError(next);
};

var commandError = function(next) {
	var toSpeak = '';
	var availableTTS = words["command_error"];
	if (Object.keys(availableTTS).length > 0) {
		var choice = Math.floor(Math.random() * Object.keys(availableTTS).length); 
		toSpeak = availableTTS[choice];
	}

	next({'tts': toSpeak});
};

var actionWeather = function(data, next) {
	console.log('\x1b[91mmode=METEO \x1b[0m');

	var pluginProps = Config.modules.weather;
	if (!pluginProps.weather_zip) {
		console.log("Missing Weather config in prop file");
		next({'tts' : 'Configuration invalide'});
		return;
	}

	var zipcode = padZip((data.zip || pluginProps.weather_zip), 6);

	var url = 'http://www.meteo-france.mobi/ws/getDetail/france/' + zipcode + '.json'
	var request = require('request');

	request({ 'uri' : url }, function (err, response, body) {
		if (err || response.statusCode != 200) {
			next({'tts': "Désolé mais je n'ai pas trouvé les informations demandées"});
			return;
		}

		//console.log("Météo zip=" + zipcode + " date=" + data.date + " period=" + data.period + " (valeur défaut date=" + pluginProps.weather_date + " period=" + false + ")");

		var tts = parseWeather(body, data.date || pluginProps.weather_date, data.period || false);
		next({'tts': tts});
  	});
};

var parseWeather = function(body, date, period) {

  var result = JSON.parse(body);

  var prevision = getPrevision(result, date, period);
	var tts = "";

	if (prevision.error == true) {
		tts = prevision.message;
	}
	else {
		tts = prevision.jour + ", ";
		tts += prevision.ville + ", ";
		tts += prevision.description + " ";
		tts += prevision.temperature;
	}

  return tts;
};

var getPrevision = function(meteo, date, period) {
	var out = { };

	out.ville = meteo.result.ville.nom;
	out.jour = '';
	out.description = '';
	out.temperature = '';
	out.error = false;
	out.message = '';

	var numDaySearch = false;
	
	if (date == 'lundi')         { numDaySearch = 1;}
  	else if (date == 'mardi')    { numDaySearch = 2;}
  	else if (date == 'mercredi') { numDaySearch = 3;}
  	else if (date == 'jeudi')    { numDaySearch = 4;}
  	else if (date == 'vendredi') { numDaySearch = 5;}
  	else if (date == 'samedi')   { numDaySearch = 6;}
  	else if (date == 'dimanche') { numDaySearch = 0;}

	var today = new Date();
  	var numToday = today.getDay();
  	var index = 0;

  	if (numDaySearch === false)
    	index = date;
  	else
  	{
	    if (numDaySearch >= numToday)
    	  index = numDaySearch - numToday;
    	else
      		index = 7 - (numToday - numDaySearch);
  	}
	
	if (index > 5) {
		out.error = true;
		out.message = "Je ne dispose pas encore des prévisions météorologiques pour " + date;
		return out;
	}
	
	var prevision = null;
	var previsionIndex = "";
	
	if (period == false) {
		prevision = meteo.result.resumes;
		previsionIndex = index + "_resume";
	}
	else {
		prevision = meteo.result.previsions;
		previsionIndex = index + "_" + fromPeriod(period);
	}
	
	//console.log("meteo: index=" + previsionIndex);
	
  	var timestamp = prevision[previsionIndex].date;

	out.jour = getJour(timestamp,  index, period);
	out.description = prevision[previsionIndex].description;
	out.temperature = getTemperature(prevision[previsionIndex]);

	return out;
};

var padZip = function (str, max) {
	str = str.toString();
	return str.length < max ? padZip("0" + str, max) : str;
};

var fromPeriod = function(period) {
	if (period == 'morn')
		return "matin";
	else if (period == 'day')
		return "midi";
	else if (period == 'eve')
		return "soir";
	else
		return "nuit";
};

var getDayName = function(i) {
  var d = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
  return d[i];
};

var getJour = function(timestamp, index, period) {
  var days = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];

	var searchDate = new Date(timestamp);

	var jour = "";
	if (index == 0)
		jour = "aujourd'hui";
	else if (index == 1)
		jour = "demain";
	else
		jour = days[searchDate.getDay()];

	if (period == 'morn')
		jour = jour + ( (index == 0) ? " dans la matinée" : " matin");
	else if (period == 'day')
		jour = jour + " dans la journée";
	else if (period == 'eve')
		jour = ((index == 0) ? "ce soir" : (jour + " soir"));
	else if (period == 'night')
		jour = ((index == 0) ? "cette nuit" : ("dans la nuit de " + jour));
	
	//console.log("meteo: jour=" + jour);

	return jour;
};

var getTemperature = function(prevision) {
	var tempMin = Math.round(parseFloat(prevision.temperatureMin));
	var tempMax = Math.round(parseFloat(prevision.temperatureMax));

	//console.log("meteo: temp min=" + tempMin + " / temp max=" + tempMax);

 	var realMin = Math.min(tempMin, tempMax);
	var realMax = Math.max(tempMin, tempMax);
	
	if (realMin == realMax) {
		return "avec une température de " + realMin + " degrés";
	}
	else {
		return "et des températures prévues entre " + realMin + " et " + realMax + " degrés";
	}
};
