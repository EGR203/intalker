const dgram = require('dgram');
var doorman = dgram.createSocket('udp4');


doorman.on('error',(err) => {
	console.log('Brodcast doorman error:\n '+err);
	doorman.close();
});
doorman.on('listening',()=>{
	console.log('Листининг');
	doorman.setBroadcast(true);
});
const brdIntervalTime =200;
const brdKey = '128500a2b2c2';
const brdMask = '';
const brdPort = 9970;
const brdCompetitionKey = brdKey + 'iAmServer'; 

var priority = 9;

doorman.send(priority + '::'+ brdCompetitionKey+'2', brdPort, brdMask, ()=>{
	console.log('Сообщение улетело');
	doorman.close();
});