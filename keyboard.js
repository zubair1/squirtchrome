// in the content script, listen for Crtl+Shift+E (upper or lowercase)
document.documentElement.addEventListener("keypress", function(e) {
    if( e.keyCode == 5 || ((e.keyCode == 69 || e.keyCode == 101) && e.ctrlKey && e.shiftKey) ) {
		var extpath = extpath = chrome.extension.getURL('');
		var action_url = "javascript:(function(){if(window.sq){ window.sq.closed && window.document.dispatchEvent(new Event('squirt.again')); } else { window.sq = {}; window.sq.extpath = '"+extpath+"'; window.sq.userId = '--squirtUser--'; s = document.createElement('script'); s.src = '"+chrome.extension.getURL('squirt.js')+"'; s.s = window.location.search; s.idx = s.s.indexOf('sq-dev'); document.body.appendChild(s); }})();";

		window.location = action_url;
    }
}, true);