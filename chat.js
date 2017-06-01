const net = require('net');
const dgram = require('dgram');
const readline = require('readline');

var rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
	});

//ключевые команды для отделения данных в tcp сообщениях
const commandKey =':c!:';
const commandPattarn = new RegExp('^'+commandKey);
const strDiviner = '  : ';

//добавить сканирование у сервера на наличие серверов в сетке
//если есть, то попросить переключиться
//и выкинуть случайное число


//Настройки broadcast`а
const brdIntervalTime =200;
const brdKey = '128500a2b2c2';
const brdMask = '';
const brdPort = 9970;
//прокоментировать нижестоящую переменную
const brdCompetitionKey = brdKey + 'iAmServer'; 
const brdCompetitionPattern = new RegExp('([1-9])::' + brdCompetitionKey + '(.+)');
const defaultServerPort = 9973;


var	nickname =  process.argv[2] ? process.argv[2] : ( getRandomInt(0,500) + '-anonim' );
var application = null;


/////////////////////////////////////////////////////////////////
/// Вспомогательные функции
/////////////////////////////////////////////////////////////////

function purgeData(){
	if(application && application['destroyed'] !== false){
		application.destroy();
	}
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

//Функция вызывается сервером
//Слушает броадкаст, ожидая запросы клиентов
function createDoorman(){
	var doorman = dgram.createSocket('udp4');
	var competitionTimerId;
	
	function sendCompetitionRequest(numb){
		if(numb === undefined){
			numb = getRandomInt(1,8);
		}
		doorman.send(numb + '::' + brdCompetitionKey +nickname , 0, 0, brdPort, brdMask);
	}

	doorman.on('message', (msg, rinfo) => {
		if(msg == brdKey){
			doorman.send(brdKey, 0, 0, rinfo.port , rinfo.address);
		}

		msg = msg.toString('utf8');

		var competitionTest;
		if(competitionTest = brdCompetitionPattern.exec(msg)){
			var concurentPriority = competitionTest[1];
			var concurentName = competitionTest[2];
			if(concurentName == nickname) {
				return;
			}

			if( concurentPriority > getRandomInt(1,8)){
				console.log('В сети найден еще 1 сервер');
				console.log('Cканирую сеть');
				findServer();
			}else{
				sendCompetitionRequest(9);
			}
		}
	});
	doorman.on('error',(err) => {
		console.log('Brodcast doorman error:\n '+err);
		doorman.close();
	});
	doorman.on('close',()=>{
		clearTimeout(competitionTimerId);
	});
	doorman.on('listening',function(){
		console.log('Запускаю broadcast doorman');
		doorman.setBroadcast(true);

		competitionTimerId = setInterval(sendCompetitionRequest,brdIntervalTime*100);
	});
	doorman.bind( brdPort, brdMask);
	return doorman;
}
//пытается найти сервер  и подключиться к нему
//если не находит - создает свой
function findServer(){
	purgeData();

	var finder = dgram.createSocket('udp4');
	var sendTimerId;

	finder.on('message', (msg, rinfo) => {
		if(msg == brdKey){
			console.log('Найден сервер:' + rinfo.address);
			finder.close();			
			clearTimeout(sendTimerId);
			application = createClient(defaultServerPort, rinfo.address);
		}
	});
	finder.on('error',(err) => {
		console.log('Порт broadcast`а занят, повторная попытка через ' + brdIntervalTime*3/1000 + ' секунд(ы) ');
	 	finder.close();
	 	clearTimeout(sendTimerId);
		setTimeout(findServer,brdIntervalTime * getRandomInt(1,7) + getRandomInt(0, 400));
	});
	finder.on('listening',function(){
		console.log('Ищем сервера');
		finder.setBroadcast(true);

		var index = 0;
		var requestNum = getRandomInt(3,7);

		finder.send(brdKey, 0, 0, brdPort, brdMask);	
		sendTimerId = setInterval(function(){
			//если сервер не появляется после 3-7 запросов
			//создать сервер
			if(index >= requestNum){
				finder.close();
				clearTimeout(sendTimerId);
				console.log('Сервера не найдены, создаю сервер');
				application = createServer();
				return;
			}
			finder.send(brdKey, 0, 0, brdPort, brdMask);
			index ++;
		}, brdIntervalTime + getRandomInt(0,100));
	});
	//байндимся на любой свободный порт
	finder.bind( '', brdMask);

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
			netServer.clients.remove(client);
			netServer.sendAll("[-] Клиент " + client.ip + ":" + client.remotePort + " " + client.nickname + " отключен", 'SERVER');
		});
		netServer.clients.push(client);		
	}); 


	netServer.destroy = function(){
		for(var i in this.clients){
			if(typeof(this.clients[i]) != 'function'){
				this.clients[i].destroy();
			}
		}
		if(doorman['_receiving']){
			doorman.close();
		}
		this.close();
	}

	netServer.on('listening',function(){
		netServer.nickname = nickname;
		netServer.ip = '127.0.0.1'; //дефолтный айпишник
		netServer.clients = [];
		console.log('Сервер создан\\n\n');
	});
	//возникает, если одновременно создать сервер на 1ом компьютере
	netServer.on('error',function(err){
		console.log('Произошла ошибка при создании сервера TCP,');
		console.log('Предпринята попытка пересканировать сеть');
		netServer.destroy();	
		findServer();
	});

	netServer.listen( defaultServerPort );
	//Рассылка сообщения всем, кроме владельца (в том числе и клиенту на сервере)
	netServer.sendAll = function(msg, owner){
		var data = owner === 'SERVER' ? 'SERVER' : (owner.nickname + " (" + owner['ip']+")" );
		data+= strDiviner + msg;
		for(var i = 0; i< netServer.clients.length ; i++){
			if(this.clients[i] !== owner) {
				this.clients[i].write(data);
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
		connect.destroy();
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