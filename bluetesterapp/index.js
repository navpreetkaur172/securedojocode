'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const qs = require('qs');
const path = require('path');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const isValidDomain = require('is-valid-domain');
const isValidIP = require('ip-regex');
const app = express();
const PORT = 8081;
const HOST = '0.0.0.0';
const htmlEncode = require('htmlencode').htmlEncode;

var limiter = new rateLimit({
	windowsMS: 1 * 60 * 1000,
	max: 20,
	message: 'Too many request from this IP, please try again in one minute'
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("views"));
app.use(limiter);

axios.defaults.headers.post['Content-Type'] = 'application/x-www-form-urlencoded';

var masterSalt = "";
if(process.env.MASTER_SALT){ 
	masterSalt=process.env.MASTER_SALT;
} else {
	console.log('Expected MASTER_SALT env varaible to be set');
}

var dataCh1 = "form_id=user_register_form&_drupal_ajax=1&mail[#post_render][]="
var dataCh2 = qs.stringify({
	name: ';whoami '
});

app.get('/*',(req, res) => {
	res.sendFile(path.join(__dirname, 'views/form.html'));
});

app.post('/attack',async (req, res) => {
	const attck = req.body.host;
	const codeSalt = req.body.salt;
	const challenge = req.body.radio;
    var hash = crypto.createHash('sha256').update(challenge+codeSalt+masterSalt).digest('base64');

	let responseMessage = "";

	try{
		if(isValidDomain(attck) || isValidIP({exact: true}).test(attck)){
			if(challenge == "blue_ch1") {
				await axios.post(
					'http://' + attck + ':8080/user/register?element_parents=account/mail/#value&ajax_form=1&_wrapper_format=drupal_ajax',
					dataCh1 + hash);

			} else if (challenge == "blue_ch2"){
				await axios.post(
					'http://' + attck + ':8888/ping.php',
					dataCh2 + hash);
			} else {
				throw(new Error("Challenge number is not valid"));
			}

			responseMessage = "Connection succeeded when it should have been blocked. Was the security defense correctly configured?";

		} else {
			throw new Error("The host entered can not be used by our application, please use an ip address or a domain. Do not enter http:// or the port number!");
		}

	}catch(err){

		//this is the case where the connection was blocked as expected
		if(err.message.indexOf("socket hang up")>-1){
			res.setHeader("Refresh", "7;url=/");
			res.sendFile(path.join(__dirname, 'views/request.html'));
			return; //we're done
		}

		console.log(err.message);
		responseMessage = err.message;

	}

	res.setHeader("Refresh", "30;url=/");
	res.send(htmlEncode(responseMessage));
	
});

process.on('SIGINT', function() {
	process.exit();
});

app.listen(PORT, function () {
	console.log(`Tester application listening at ${HOST}:${PORT}`)
})