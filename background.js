chrome.browserAction.onClicked.addListener(function (tab) {
	//chrome.tabs.executeScript(tab.id, {"file": "squirt.js"});
	/*if(window.sq){
		window.sq.closed && window.document.dispatchEvent(new Event('squirt.again'));
	} else {
		window.sq = {};
		window.sq.userId = '--squirtUser--';
		s = document.createElement('script');
		s.src = 'https://raw.githack.com/notzoom/jsexample/master/squirt.js';
		s.s = window.location.search;
		s.idx = s.s.indexOf('sq-dev');
		document.body.appendChild(s);
	}*/
	var extpath = extpath = chrome.extension.getURL('');
	var action_url = "javascript:(function(){if(window.sq){ window.sq.closed && window.document.dispatchEvent(new Event('squirt.again')); } else { window.sq = {}; window.sq.extpath = '"+extpath+"'; window.sq.userId = '--squirtUser--'; s = document.createElement('script'); s.src = '"+chrome.extension.getURL('squirt.js')+"'; s.s = window.location.search; s.idx = s.s.indexOf('sq-dev'); document.body.appendChild(s); }})();";

	chrome.tabs.update(tab.id, {url: action_url});
});
