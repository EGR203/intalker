const net = require('net');
const dgram = require('dgram');
const readline = require('readline');

var rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
	});


const commandKey =':c!:';
const commandPattarn = new RegExp('^'+commandKey);
const strDiviner = '  : ';



const brdcIntervalTime =700;
const broadcastKey = '128500--+';
const broadcastMask = '';
const broadcastPort = 9970;

const defaultPort = 9973;


var clients = [];
var	nickname =  process.argv[2] ? process.argv[2] : ( getRandomInt(0,500) + '-anonim' );


/////////////////////////////////////////////////////////////////
/// Вспомогательные функции
/////////////////////////////////////////////////////////////////

function readLinePurge(){
	clients = [];
	rl.close();
	rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout
	});	
}

function beautyConsole(msg){
	console.log("-         -         -          -          "+ getCustomeDate()+ " " + msg);
}

function getCustomeDate(){
	var date = new Date();
	return ('[' +date.getHours() +":" + date.getMinutes() +":"+ date.getSeconds() +"]");
}

Array.prototype.remove = function(value) {
    var idx = this.indexOf(value);
    if (idx != -1) {
        // Второй параметр - число элементов, которые необходимо удалить
        return this.splice(idx, 1);
    }
    return false;
}
function getRandomInt(min, max)
{
  return Math.floor(Math.random() * (max - min + 1)) + min;
}


/////////////////////////////////////////////////////////////////
/// Основные функции
/////////////////////////////////////////////////////////////////

//переделать сканирование броадкаста на запрос в броадкасте
function scanBroadcast(){
	var brdSock = dgram.createSocket('udp4');
	var createServerTimer;
	
	readLinePurge();

	//Перезапуск сканирования из за занятого порта
	brdSock.on('error', (err) => {
		console.log('Порт broadcast`а занят, повторная попытка через ' + brdcIntervalTime*3/1000 + ' секунд(ы) ');
		brdSock.close();
		clearTimeout(createServerTimer);
		setTimeout(scanBroadcast,brdcIntervalTime * 3);
	});

	//Подключение клиента к откликнувшему серверу
	brdSock.on('message', (msg, rinfo) => {
		if(msg == broadcastKey){
			console.log('Найден сервер:' + rinfo.address);
			brdSock.close();
			clearTimeout(createServerTimer);
			createClient(defaultPort, rinfo.address);	
		}
	});

	//если порт свободный, сканируем бродкаст
	brdSock.on('listening', () => {
		var address = brdSock.address();
		brdSock.setBroadcast(true);
		console.log(`Слушаю broadcast на ${address.address}:${address.port}`);
		
		//таймер на создание сервера
		createServerTimer = setTimeout(function(){
			console.log('Сервера не найдены, создаю сервер');
			brdSock.close();
			createServer();
		}, brdcIntervalTime * 3);
	});

	brdSock.bind( broadcastPort, broadcastMask);
}

/////////////////////////////////////////////////////////////////
/// Сервер
/////////////////////////////////////////////////////////////////
function createServer(){
	var netServer = net.createServer(function (client){
		//server.ip  и client.ip  нужны только для отображения этого IP в сообщениях
		//попытка изменять отображение айпи по умолчанию при каждом подключении клиента
		if( netServer.ip == '127.0.0.1' || netServer.ip == undefined ){
			netServer.ip = client.localAddress.replace( /::ffff:/ , '' );
		}

		client.ip = client.remoteAddress.replace( /::ffff:/ , '' );
		
		client.setEncoding('utf8');		
		netServer.sendAll("[+] Клиент " + client.ip + ":" + client.remotePort + " подключен", 'SERVER');
		client.on('data',function(data){
			if( commandPattarn.test(data) ){
				client.nickname = data.replace(commandPattarn,'');
				msg = client.ip + ' -> ' + client.nickname;
				netServer.sendAll(msg, 'SERVER');
			}else{				
				netServer.sendAll(data , client);
			}
		});

		client.on('end', function(){
			clients.remove(client);
			netServer.sendAll("[-] Клиент " + client.ip + ":" + client.remotePort + " " + client.nickname + " отключен", 'SERVER');
		});
		clients.push(client);		
	}); 
	netServer.on('listening',function(){
		netServer.nickname = nickname;
		netServer.ip = '127.0.0.1'; //дефолтный айпишник
		console.log('Сервер создан');
	});
	netServer.on('error',function(err){
		console.log(err);
	});

	netServer.listen( defaultPort );
	//Рассылка сообщения всем, кроме владельца (в том числе и клиенту на сервере)
	netServer.sendAll = function(msg, owner){
		var data = owner === 'SERVER' ? 'SERVER' : (owner.nickname + " (" + owner['ip']+")" );
		data+= strDiviner + msg;
		for(let i = 0; i< clients.length ; i++){
			if(clients[i] !== owner) {
				clients[i].write(data);
			}
		}
		if( owner !== netServer){
			beautyConsole(data);
		}
	}

	//Сервер запускает broadcast "маяк"
	netServer.beaconTimerId = (function(){

		beacon = dgram.createSocket('udp4');
		beacon.on('error',(err) => {
			console.log('Brodcast error:\n '+err);
		});
		beacon.on('listening',function(){
			console.log('Запускаю broadcast');
			beacon.setBroadcast(true);
		});

		function sendBroadcastKey(){
			beacon.send(broadcastKey, broadcastPort, broadcastMask);
		}

		sendBroadcastKey();

		return setInterval(function(){sendBroadcastKey();}, brdcIntervalTime);
		
	})();	

	rl.on('line',function(input){
		netServer.sendAll(input, netServer);
	});

	return netServer;//net.server	
}
/////////////////////////////////////////////////////////////////
/// Клиент
/////////////////////////////////////////////////////////////////

function createClient(port, ip){
	var connect = net.createConnection(port,ip, function(){
		connect.setEncoding('utf8');
		connect.write(commandKey + nickname);
		console.log("Соединение с сервером успешно установленно\n");
	});
	connect.on('close',function(){
		console.log('соединение сброшено\nПопытка повторного соеденения\n\n');
		setTimeout(scanBroadcast, getRandomInt(0,500) );
	});
	connect.on('data', beautyConsole);
	rl.on('line', (input) => {
		connect.write(input);
	});

	return connect;
}

/////////////////////////////////////////////////////////////////
/// Сценарий приложения
/////////////////////////////////////////////////////////////////
console.log('Ваш никнейм: '+nickname);
scanBroadcast();