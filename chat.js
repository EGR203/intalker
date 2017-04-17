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



const brdcIntervalTime =1000;
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

//Функция для сервера
//Слушает броадкаст и ждет кодовую комбинацию, чтобы послать клиенту
//свой айпи
function createDoorman(){
    //Сканер броадкаста (ждем клиентов)
	var doorman = dgram.createSocket('udp4');

	doorman.on('message', (msg, rinfo) => {
		if(msg == broadcastKey){
			doorman.send(broadcastKey, rinfo.port , rinfo.address);
		}
	});
	doorman.on('error',(err) => {
		console.log('Brodcast doorman error:\n '+err);
		doorman.close();
	});
	doorman.on('listening',function(){
		console.log('Запускаю broadcast doorman');
		doorman.setBroadcast(true);
	});
	doorman.bind( broadcastPort, broadcastMask);
	return doorman;
}

//переделать сканирование броадкаста на запрос в броадкасте
function findServer(){
	readLinePurge();

	var client = dgram.createSocket('udp4');
	var sendTimerId;

	client.on('message', (msg, rinfo) => {
		if(msg == broadcastKey){
			console.log('Найден сервер:' + rinfo.address);
			client.close();
			clearTimeout(sendTimerId);
			createClient(defaultPort, rinfo.address);
		}
	});
	client.on('error',(err) => {
		console.log('Порт broadcast`а занят, повторная попытка через ' + brdcIntervalTime*3/1000 + ' секунд(ы) ');
	 	client.close();
	 	clearTimeout(sendTimerId);
		setTimeout(findServer,brdcIntervalTime * getRandomInt(1,7) + getRandomInt(0, 400));
	});
	client.on('listening',function(){
		console.log('Ищем сервера');
		client.setBroadcast(true);

		var index = 0;
		var requestNum = getRandomInt(3,7);

		client.send(broadcastKey, broadcastPort, broadcastMask);	
		sendTimerId = setInterval(function(){
			client.send(broadcastKey, broadcastPort, broadcastMask);
			index ++;
			//если сервер не появляется после 3-7 запросов
			//создать сервер
			if(index >= requestNum){
				client.close();
				clearTimeout(sendTimerId);
				console.log('Сервера не найдены, создаю сервер');
				createServer();
			}
		}, brdcIntervalTime + getRandomInt(0,100));
	});
	//байндимся на любой свободный порт
	client.bind( '', broadcastMask);

}

/////////////////////////////////////////////////////////////////
/// Сервер
/////////////////////////////////////////////////////////////////

function createServer(){
	var doorman = createDoorman();
										//действия при подключении клиента
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
		console.log('Сервер создан\\n\n');
	});
	//возникает, если одновременно создать сервер на 1ом компьютере
	netServer.on('error',function(err){
		console.log('Произошла ошибка при создании сервера TCP,');
		console.log('Предпринята попытка пересканировать сеть');
		if( doorman ){
			doorman.close();
		}
		netServer.close();
		findServer();
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


	rl.on('line',function(input){
		netServer.sendAll(input, netServer);
	});

	return netServer;	
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
		setTimeout(findServer, getRandomInt(0,500) );
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
findServer();