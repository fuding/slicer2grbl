var path = require('path');
var lineReader = require('line-reader');
var fs = require('fs');


// the modified lines
var newData = '',
	config = {
		initialZOffset : undefined,
		layerThickness : 0.2,
		inFile : 'in.gcode',
		outFile : 'out.gcode',
		zLift : undefined
	};

// Parse command line arguments to override the default settings
process.argv.forEach(function (val, index, array) {
	var param = '';
  
	if (val.indexOf('--') === 0) {
		param = val.replace('--', '').split('=');

		if (config.hasOwnProperty(param[0])) {
			if (typeof config[param[0]] === 'string') {
				config[param[0]] = param[1];
			} else {
				config[param[0]] = parseFloat(param[1]);
			}
		}
	}
});

console.log(config);

var z = config.initialZOffset;
var zLookup = 0;

// some runtime variables
var nbLayers = 0;
var inLayer = false; // only alter lines inside the layers
var destring = false;

// read each line of the original file
lineReader.eachLine(config.inFile, function(line, last) {
	_line = '',
	zValue = null;

	if (line.indexOf('; Z_lift_mm') === 0 && typeof config.zLift === 'undefined') {
		config.zLift = parseFloat(line.replace(' ', '').split('=')[1]);
	} else if (line.indexOf('; layer_thickness_mm') === 0) {
		newData += '; layer_thickness_mm = -' + config.layerThickness + '\n'; //Shouldn't this be defined in slicer ?

	} else if (line.indexOf("; 'Destring/Wipe/Jump Path',") === 0) {
		destring = true; //set destring flag true to search for destring z in next lines
		newData += line;
	} else if (line.indexOf('; BEGIN_LAYER_OBJECT') === 0) {
		zLookup = parseFloat(line.match(/z=(.*)/gi)[0].replace('z=', '')); // Current layer z value

		// get the initial zOffset from the first layer if not overriden by the command line param
		if (nbLayers === 0 && typeof config.initialZOffset === 'undefined') {
			z = zLookup;
			config.initialZOffset = zLookup;
			newData += line; // no need to alter the line
		// but if the command line param override the initial Zoffset then we need to change the z value here
		} else {		
			newData += line.replace(/z=.*/, 'z=' + (Math.round(z*100) / 100).toFixed(2));
		}

		nbLayers++;		
		// flag to parse the next lines
		inLayer = true;
	} else if (line.indexOf('; END_LAYER_OBJECT') === 0) {
		inLayer = false;
		newData += line.replace(/z=.*/, 'z=' + (Math.round(z*100) / 100).toFixed(2));
		
		// decrease the z offset
		z -= config.layerThickness;
	} else if (inLayer) {
		_line = line;
		zValue = line.match(/Z([\d.]+)\s*?/gi);
		// if found a 'Z' in the line
		if (zValue) {		
		
			if (destring) { // destring happens only inside layers
				_line = line.replace(zValue[0], 'Z' + (Math.round( (config.initialZOffset + config.zLift) * 100) / 100).toFixed(2));
				destring = false;
			} else {
				// And if the Z value match the origin layer z= value
				if (parseFloat(zValue[0].replace('Z', '')) === zLookup) {
					// Alter the value of Z
					_line = line.replace(zValue[0], 'Z' + (Math.round(z*100) / 100).toFixed(2));
				}
			}
		}
			// Append the line
		newData += _line;
	} else {
		newData += line; // Just append the unchanged line
	}

	// Last line then save the new file
	if (last){
		console.log('Finished : ' + nbLayers + ' layers processed');
		saveFile(config.outFile, newData);
	}
});

/**
 * Save a text File
 * @param _fileName {string} the name of the file to create
 * @param data {string} text to save
 */
function saveFile(_fileName, data) {
	
	fs.writeFile(_fileName, data, function(err) {
		if(err) {
			return console.log(err);
		} else {
			console.log('Modified GCODE saved into : ' + _fileName);
		}
	}); 
}