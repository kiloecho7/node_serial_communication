//----------- Libraries --------------
var http = require('http');
var SerialPortLib = require("serialport");
var BigNumber = require('big-number').n;
var moment = require('moment');
var ConvertBase = require('convert-base');
var async = require('async');


//----------- Global Variables --------------
var prevRfid = -1
var datetimeFormat = "MM/DD/YYYY HH:mm:ss"
var portName = 'COM1';
var serialPort;
var converter = new ConvertBase();


function openPort(portName) {
  serialPort = new SerialPortLib.SerialPort(portName, { baudrate: 57600 }, true);
  if ( isDefined(serialPort) ) {
    serialPort.on('data', onData);
  } else {
    console.log('Failure opening serial port ' + portName)
  }
}


function sendRead() {
  if (isDefined(serialPort)) {
    serialPort.write(createAllInOneReadCommand())
  }
}

function onData(info) {
  var data = arrayBufferToTypedArray(info)
  readBuffer = data

  if (noTagRead(readBuffer)) {
    currRfid = 0;
  } else {
    var currRfid = extractRfidValue(readBuffer)
  }

  if ( rfidTransponderChange( currRfid, prevRfid) ) {
    if ( isNoTagRead(currRfid) ) {
      console.log( moment().format(datetimeFormat) + ' No tag read')
    } else {
      console.log( moment().format(datetimeFormat) + ' RFID tag read: ' + currRfid + ' ' + toHex(currRfid).substring(2, 18).toUpperCase());
    }
    prevRfid = currRfid
  }
}

function toHex(number) {
  return converter.convert(number, 10, 16)
}

function rfidTransponderChange( currRfid, prevRfid) {
  return parseInt(currRfid) != parseInt(prevRfid)
}

function isNoTagRead(rfid) {
  return rfid == 0
}

function arrayBufferToTypedArray(buf) {
  return String.fromCharCode.apply(null, new Uint8Array(buf));
}


function noTagRead(data) {
  return (data.charCodeAt(7) == 0 && data.charCodeAt(8) == 0)
}


function getMessageLength(data) {
    if (data.length < 2)
      return undefined;
    else
      return data.charCodeAt(1)
}

function extractRfidValue(buffer) {
  var rfid = new BigNumber("0")
  var rfidIndex = 0
  var ARRAY_INDEX_START = 13;
  for(arrayIndex = ARRAY_INDEX_START; arrayIndex < ARRAY_INDEX_START + 8; arrayIndex++) {
    charCode = buffer.charCodeAt(arrayIndex)
    var shiftAmount = (rfidIndex * 8)
    var currByteValue = leftShift(charCode, shiftAmount)
    rfid = rfid.add(currByteValue)
    rfidIndex++
  }
  return rfid
}

function removeHexPrefix(hexString) {
  return hexString.substring(2, hexString.length)
}

//Use this instead of the bit shift operator. Javascript uses 32 bit ints 
//for bit shifting so your result will wrap around if it's too large.
function leftShift(numInt, shiftAmountInt) {
  var two = new BigNumber("2")
  var num = new BigNumber(numInt)
  var shiftAmount = new BigNumber(shiftAmountInt)
  var multiplicand = two.pow(shiftAmount)
  var product = num.multiply(multiplicand)
  return product
}

function createAllInOneReadCommand() {
  var SOF = 0x01;
  var INV_CMD = 0x60;
  var index = 0;
  var arrayBuffer = new ArrayBuffer(13);
  var uint8View = new Uint8Array(arrayBuffer);

  uint8View[index++] = SOF;
  uint8View[index++] = 0x0D; // Length LSB
  uint8View[index++] = 0x00; // Length MSG
  uint8View[index++] = 0x00; // Node address LSB
  uint8View[index++] = 0x00; // Node address MSB
  uint8View[index++] = 0x00; // Command Flag
  uint8View[index++] = INV_CMD; // Specify ISO 15693 command
    
  // This section of the message is the actual ISO 15963 command.
  uint8View[index++] = 0x11; // Config byte - 100% modulation, data coding 1/4
  uint8View[index++] = 0x07; // Flags
  uint8View[index++] = 0x01; // Inventory command
  uint8View[index++] = 0x00; // Mask length    
  // End of ISO 15963 command.

  // The BCC calculation here works because BCC is not affected by bytes 
  // with the value of 0x00. The last two bytes are 0x00 and will be 
  // assigned values resulting from the BCC calculation.
  //-------------- the original code calculates the bcc but this implementation is not working corrrectly so I've hard coded it.
  //var bcc = calcBCC( arrayBuffer );
  var bcc = 123;
  uint8View[index++] = bcc;
  var antiBCC = ~bcc & 0xFF;
  uint8View[index++] = antiBCC;

  return uint8View;
}

function isDefined(obj) {
  return (typeof obj != 'undefined');
}







openPort(portName)
setInterval( sendRead, 250, serialPort);  

