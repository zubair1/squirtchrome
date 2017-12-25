var sq = window.sq;
sq.version = '0.0.1';
sq.host =  window.sq.extpath;
sq.cookies = {
	loader: sq.host + 'cookie.js',
	timeout: 3000,
	values: false
};

sq.progressBarLocation = sq.progressBarLocation || 'bottom';

(function(){

  bindEvent(window, 'message', function (e) {
	  var msg = e.data;
	  if (typeof msg == "object" && msg.squirt_reply ){
		  delete msg.squirt_reply;
		  sq.cookies.values = {};
		  for (var k in msg){
			  if (msg.hasOwnProperty(k)) {
				  sq.cookies.values[k] = msg[k];
			  }
		  }
		  if (cookiesTimeout){
			  clearTimeout(cookiesTimeout);
			  makeSquirt(makeRead(makeTextToNodes(wordToNode)), makeGUI);
		  }			
	  }				
  });	
  var cookiesTimeout = setTimeout(function(){ 
	  makeSquirt(makeRead(makeTextToNodes(wordToNode)), makeGUI);
  }, sq.cookies.timeout);	
	
  loadCookiesFrame();

  function makeSquirt(read, makeGUI) {

    on('squirt.again', startSquirt);
    injectStylesheet(sq.host + 'font-awesome.css');
    injectStylesheet(sq.host + 'squirt.css', function stylesLoaded(){
      makeGUI();
      startSquirt();
    });

    function startSquirt(){
      // Since this needs to be done before the GUI is shown
      if (window.location.hostname.indexOf('washingtonpost.com') != -1){
	  var hiddenElement = document.getElementById('bottom-furniture');
	  if (hiddenElement){
	      hiddenElement.outerHTML = '';
	      delete hiddenElement;
	  }
      }

      showGUI();
      getText(read);
    };

    function removeUnwantedElements(article){
		
	    // Custom element removal
	    let removeElements = (elms) => Array.from(elms).forEach(el => el.remove());	
	    removeElements( article.querySelectorAll(".image-and-copyright-container") );		
	    removeElements( article.querySelectorAll("sup") );	
	    removeElements( article.querySelectorAll("style") );
	    removeElements( article.querySelectorAll("script") );
	    removeElements( article.querySelectorAll("noscript") );
	    removeElements( article.querySelectorAll(".mw-editsection") );

	    if (window.location.hostname.indexOf('wikipedia.org') != -1){
		    removeElements( article.querySelectorAll(".infobox") );
		    removeElements( article.querySelectorAll(".reflist") );
	    }
	    if (window.location.hostname.indexOf('businessinsider.com') != -1){
		    removeElements( article.querySelectorAll(".source") );
		    removeElements( article.querySelectorAll(".slideshow-content") );
	    }
	    if (window.location.hostname.indexOf('coindesk.com') != -1){
		    removeElements( article.querySelectorAll(".ebz_native_center") );
	    }
		
	    // Span element unwrap
            var span = article.querySelectorAll("span");
            if( span.length ) {
            [].forEach.call( span, function(e) {
               var parent = e.parentNode;
               // move all children out of the element
               while (e.firstChild) parent.insertBefore(e.firstChild, e);
               // remove the empty element
               parent.removeChild(e);
             });
            }
		
	    return article;
    }
	
    function getText(read){
      // text source: demo
      if(window.squirtText) return read(window.squirtText);

      // text source: selection
      var selection = window.getSelection();
      if(selection.type == 'Range') {
        var container = document.createElement("div");
        for (var i = 0, len = selection.rangeCount; i < len; ++i) {
          container.appendChild(selection.getRangeAt(i).cloneContents());
        }
		container = removeUnwantedElements(container);
        return read(container.textContent);
      }

      // text source: readability
      var handler;
      function readabilityReady(){
        handler && document.removeEventListener('readility.ready', handler);
		let article = readability.grabArticle();
		article = removeUnwantedElements(article)
		read(readability.grabArticleText(article));
      };

      if(window.readability) return readabilityReady();

      makeEl('script', {
        src: sq.host + 'readability.js'
      }, document.head);
      handler = on('readability.ready', readabilityReady);
    };
  }

  function makeRead(textToNodes) {
    sq.paused = false;
    var nodeIdx,
        nodes,
        lastNode,
        nextNodeTimeoutId;

    function incrememntNodeIdx(increment){
      var ret = nodeIdx;
      nodeIdx += increment || 1;
      nodeIdx = Math.max(0, Math.min(nodeIdx, nodes.length));
      prerender();
      return ret;
    };

    var intervalMs, _wpm;
    function wpm(wpm){
      _wpm = wpm;
      intervalMs = 60 * 1000 / wpm ;
    };

    (function readerEventHandlers(){
      on('squirt.close', function(){
        sq.closed = true;
		dispatch('squirt.updateProgress',{percentage: 0});	
        clearTimeout(nextNodeTimeoutId);
      });

      on('squirt.wpm.adjust', function(e){
		let new_wpm = e.value + _wpm;  
        dispatch('squirt.wpm', {value: ((new_wpm > 0) ? new_wpm:10)});
      });

      on('squirt.wpm', function(e){
        sq.wpm = Number(e.value);
		if(sq.cookies.values.wpm != sq.wpm){
		   sq.cookies.values.wpm = sq.wpm;
		   saveCookies();
		}
        wpm(e.value);
        dispatch('squirt.wpm.after');
      });

      on('squirt.pause', pause);
      on('squirt.play', play);

      on('squirt.play.toggle', function(){
        dispatch(sq.paused ? 'squirt.play' : 'squirt.pause');
      });

      on('squirt.rewind', function(e){	   	  
        // Rewind by `e.value` seconds. Then walk back to the
        // beginning of the sentence.
        !sq.paused && clearTimeout(nextNodeTimeoutId);
        incrememntNodeIdx(-Math.floor(e.seconds * 1000 / intervalMs));
        while(!nodes[nodeIdx].word.match(/\./) && nodeIdx < 0){
          incrememntNodeIdx(-1);
        }
        nextNode(true);
		let finalWordContainer = document.querySelector('.sq .final-word');
		let finalStyle = window.getComputedStyle(finalWordContainer);
		if (finalStyle.display == 'block'){
			toggle(document.querySelector('.sq .reader'));
			toggle(finalWordContainer);
		}				
      });
      on('squirt.seek', function(e){	  
        !sq.paused && clearTimeout(nextNodeTimeoutId);
		let targetNode = percentageToNode(e.percentage);
		let idxchange = ( ( nodeIdx < targetNode ) ? Math.abs(nodeIdx - targetNode) : -Math.abs(nodeIdx - targetNode) );
		if (idxchange != 0){
			incrememntNodeIdx( idxchange );
			while(!nodes[nodeIdx].word.match(/\./) && nodeIdx < 0){
			  incrememntNodeIdx(-1);
			}		
			nextNode(true);
			dispatch('squirt.updateProgress',{percentage: nodeToPercentage(targetNode)});
			
			let finalWordContainer = document.querySelector('.sq .final-word');
			let finalStyle = window.getComputedStyle(finalWordContainer);
			if (finalStyle.display == 'block'){
				toggle(document.querySelector('.sq .reader'));
				toggle(finalWordContainer);
			}					
		}			
      });
      on('squirt.updateProgress', function(e){
		let progressBarPosition = document.getElementById('progress-bar-position');
		progressBarPosition.setAttribute("style","width:"+e.percentage+"%");		
      });	  
    })();

    function percentageToNode(percentage){
		let perNode = (nodes.length) ? (100/nodes.length) : 100;
		return Math.round((percentage||0)/perNode); 
    }
    function nodeToPercentage(node){
		let perNode = (nodes.length) ? (100/nodes.length) : 100;
		return Math.min(Math.max(parseFloat(perNode*node), 0), 100);
    }		
	
    function pause(){
      sq.paused = true;
      dispatch('squirt.pause.after');
      clearTimeout(nextNodeTimeoutId);
    };

    function play(e){
      sq.paused = false;
      dispatch('squirt.pause.after');
      document.querySelector('.sq .wpm-selector').style.display = 'none'
      nextNode(e.jumped); 
    };

    var toRender;
    function prerender(){
      toRender = nodes[nodeIdx];
      if(toRender == null) return;
      prerenderer.appendChild(toRender);
      nodes[nodeIdx].center();
    }

    function finalWord(){
      toggle(document.querySelector('.sq .reader'));
      showTweetButton(nodes.length,(nodes.length * intervalMs / 1000 / 60).toFixed(1));
      toggle(finalWordContainer);
      return;
    };

    var delay, jumped, nextIdx;
    function nextNode(jumped) {

      lastNode && lastNode.remove();

      nextIdx = incrememntNodeIdx();
	  
      if(nextIdx >= nodes.length){
		  dispatch('squirt.updateProgress',{percentage: 100});
		  return finalWord();
	  }

      lastNode = nodes[nextIdx];
      wordContainer.appendChild(lastNode);
      lastNode.instructions && invoke(lastNode.instructions);
	  
	  dispatch('squirt.updateProgress',{percentage: nodeToPercentage(nextIdx)});
	  
      if(sq.paused) return;
      nextNodeTimeoutId = setTimeout(nextNode, intervalMs * getDelay(lastNode, jumped));
    };

    var waitAfterShortWord = 1.2;
    var waitAfterComma = 1.3;
    var waitAfterPeriod = 3.5;
    var waitAfterParagraph = 4.5;
    var waitAfterLongWord = 1.5;
    function getDelay(node, jumped){
      var word = node.word;
      if(jumped) return waitAfterPeriod;
      if(word == "Mr." ||
          word == "Mrs." ||
          word == "Ms." ||
	  word == "U.S.") return 1;
      var lastChar = word[word.length - 1];
      var prevLastChar = word[word.length - 2];
      if(lastChar.match('”|"')) lastChar = word[word.length - 2];
      if(lastChar == '\n') return waitAfterParagraph;
      if('.!?'.indexOf(prevLastChar) != -1) return waitAfterPeriod;
      if('.!?'.indexOf(lastChar) != -1) return waitAfterPeriod;
      if(',;:–'.indexOf(lastChar) != -1) return waitAfterComma;
      if(word.length < 4 && !waitAfterPeriod) return waitAfterShortWord;
      if(word.length > 11 && !waitAfterPeriod) return waitAfterLongWord;
      return 1;
    };

    function showTweetButton(words, minutes){
      var html = "<div>You just read " + words + " words in " + minutes + " minutes!</div>";
      var tweetString = "I read " + words + " words in " + minutes + " minutes without breaking a sweat!";
      finalWordContainer.innerHTML = html;
    };

    function showInstallLink(){
      finalWordContainer.innerHTML = "<a class='install' href='/install.html'>Install Squirt</a>";
    };

    function readabilityFail(){
        var modal = document.querySelector('.sq .modal');
        modal.innerHTML = '<div class="error">Oops! This page is too hard for Squirt to read.</div>';
    };

	var startWPM = ( sq.cookies.values && sq.cookies.values.wpm && !isNaN(parseInt(sq.cookies.values.wpm)) ) ? parseInt(sq.cookies.values.wpm) : 400;
    dispatch('squirt.wpm', {value : startWPM});

    var wordContainer,
        prerenderer,
        finalWordContainer;
    function initDomRefs(){
      wordContainer = document.querySelector('.sq .word-container');
      invoke(wordContainer.querySelectorAll('.sq .word'), 'remove');
      prerenderer = document.querySelector('.sq .word-prerenderer');
      finalWordContainer = document.querySelector('.sq .final-word');
      document.querySelector('.sq .reader').style.display = 'block';
      document.querySelector('.sq .final-word').style.display = 'none';
    };

    return function read(text) {
      initDomRefs();

      if(!text) return readabilityFail();

      nodes = textToNodes(text);
      nodeIdx = 0;
	  
      prerender();
      dispatch('squirt.play');
    };
  };

  function makeTextToNodes(wordToNode) {
    return function textToNodes(text) {
      text = text.trim('\n').replace(/\s+\n/g,'\n');
      text = text.replace(/(\(\s)(?=.)/g, '(')
      text = text.replace(/(?=.)(\s\))/g, ')')
      text = text.replace(/\s(?=[\;\!\,])/g, '')
      text = text.replace(/[,](?![\"\”\'])/g, '$& ')
      text = text.replace(/(?!^)(?=.)[^\s](?=[\"\”\'])[^\s]/g, '$& ')
      text = text.replace(/([\$\£\#])(\s{1,})/g, '$1')
      text = text.replace(/['][\s]+[s][\s]+/g,  "'s ")
      text = text.replace(/['][\s]+[t][\s]+/g,  "'t ")  
      text = text.replace(/['][\s]+[d][\s]+/g,  "'d ")
      text = text.replace(/['][\s]+[m][\s]+/g,  "'m ")
      text = text.replace(/['][\s]+(re)[\s]+/g,  "'re ")
      text = text.replace(/['][\s]+(ve)[\s]+/g,  "'ve ")
      text = text.replace(/['][\s]+(ll)[\s]+/g,  "'ll ")
      text = text.replace(/['][\s]+[s][.]/g,  "'s.")
      text = text.replace(/['][\s]+[t][.]/g,  "'t.")
      text = text.replace(/['][\s]+[d][.]/g,  "'d.")  
      text = text.replace(/['][\s]+[m][.]/g,  "'m.")
      text = text.replace(/['][\s]+(re)[.]/g,  "'re.")
      text = text.replace(/['][\s]+(ve)[.]/g,  "'ve.")
      text = text.replace(/['][\s]+(ll)[.]/g,  "'ll.")
      text = text.replace(/["][\s]+[.][\s]+/g,  '". ')
      text = text.replace(/["][.]["][\s]*/g,  '". "')
      text = text.replace(/[.][\s]*[”]/g,  '.” ')
      text = text.replace(/ \…/g,  '…')
      text = text.replace(/([\s](\-|\—|\–)[\s])/g, ' ')
      text = text.replace(/[.]/g,  '. ')
      text = text.replace(/ \./g, '.')
      text = text.replace(/[\s]+[,][\s]+/g,  ', ')
      text = text.replace(/[\s]+["][\s]+/g,  '" ')
      text = text.replace(/[\s]+[”][\s]+/g,  '” ')
      text = text.replace(/([\0-9])([\,])(\s{1,})([\0-9])/g, '$1$2$4')
      text = text.replace(/([\0-9])([\.])(\s{1,})([\0-9])/g, '$1$2$4')
      text = text.replace(/([\s]+)([a-z|A-Z])([.])([\s]+)([a-z|A-Z])([.]?)([\s]+)/g,  '$1$2$3$5$6$7')
      text = text.replace(/[U][.][\s]+[S]/g,  'U.S') 
      text = text.replace(/[e][.][\s]+[g]/g,  'e.g')
      text = text.replace(/[P][h][.][\s]+[d]/g,  'Ph.d')
      text = text.replace(/[P][h][.][\s]+[D]/g,  'Ph.D')
      text = text.replace(/["][\s]*[.][\s]*["]/g,  '". "')
      text = text.replace(/[\s]+[)]/g,  ')')
      text = text.replace(/[\s]+[;]/g,  ';')
      text = text.replace(/[\s]+[?]/g,  '?')
      text = text.replace(/[\s]+[’]/g,  '’')
      text = text.replace(/[\s]+[*][\s]+([A-Z])/g,  '$1')
      text = text.replace(/[\s]+[']/g,  "'")
      // code detection
      text = text.replace(/^([^]{1,15})(=)([^]{1,15})[\n]/gm, '<CODEHERE>$1$2$3<CODEHERE>')
      var text = text.replace(/<CODEHERE>([^]+)([=])([^]+)<CODEHERE>/g, function(match) {
             return match.replace(/[\s]+/g, 'termendokz')
      })
	    
      text = text.split(/[\s]+/g)

      for(var i = 0; i < text.length; i++) {
         text[i] = text[i].replace(/termendokz/g, " ")
	 text[i] = text[i].replace(/<CODEHERE>/g, "")
      }

      text = text.filter(function(word){ return word.length; })
      text = text.map(wordToNode)
      return text;
    };
  };

  var instructionsRE = /#SQ(.*)SQ#/;
  function parseSQInstructionsForWord(word, node){
    var match = word.match(instructionsRE);
    if(match && match.length > 1){
      node.instructions = [];
      match[1].split('#')
      .filter(function(w){ return w.length; })
      .map(function(instruction){
        var val = Number(instruction.split('=')[1]);
        node.instructions.push(function(){
          dispatch('squirt.wpm', {value: val})
        });
      });
      return word.replace(instructionsRE, '');
    };
    return word;
  };

  // ORP: Optimal Recgonition Point
  function getORPIndex(word){
    var length = word.length;
    var lastChar = word[word.length - 1];
    if(lastChar == '\n'){
      lastChar = word[word.length - 2];
      length--;
    }
    if(',.?!:;"'.indexOf(lastChar) != -1) length--;
    return length <= 1 ? 0 :
      (length == 2 ? 1 :
          (length == 3 ? 1 :
              Math.floor(length / 2) - 1));
  };

  function wordToNode(word) {
    var node = makeDiv({'class': 'word'});
    node.word = parseSQInstructionsForWord(word, node);

    var orpIdx = getORPIndex(node.word);

    node.word.split('').map(function charToNode(char, idx) {
      var span = makeEl('span', {}, node);
      span.textContent = char;
      if(idx == orpIdx) span.classList.add('orp');
    });

    node.center = (function(orpNode) {
      var val = orpNode.offsetLeft + (orpNode.offsetWidth / 2);
      node.style.left = "-" + val + "px";
    }).bind(null, node.children[orpIdx]);

    return node;
  };

  var disableKeyboardShortcuts;
  function showGUI(){
    blur();
    document.querySelector('.sq').style.display = 'block';
    disableKeyboardShortcuts = on('keydown', handleKeypress);
  };

  function hideGUI(){
    unblur();
    document.querySelector('.sq').style.display = 'none';
    disableKeyboardShortcuts && disableKeyboardShortcuts();
  };

  var keyHandlers = {
      32: dispatch.bind(null, 'squirt.play.toggle'),
      27: dispatch.bind(null, 'squirt.close'),
      38: dispatch.bind(null, 'squirt.wpm.adjust', {value: 10}),
      40: dispatch.bind(null, 'squirt.wpm.adjust', {value: -10}),
      37: dispatch.bind(null, 'squirt.rewind', {seconds: 10})
  };

  function handleKeypress(e){
    var handler = keyHandlers[e.keyCode];
    handler && (handler(), e.preventDefault())
    return false;
  };

  function blur(){
    map(document.body.children, function(node){
      if(!node.classList.contains('sq'))
        node.classList.add('sq-blur');
    });
  };

  function unblur(){
    map(document.body.children, function(node){
      node.classList.remove('sq-blur');
    });
  }

  function makeGUI(){
    var squirtExtraClass = (sq.progressBarLocation == 'top') ? ' bar-top' : '';  
    var squirt = makeDiv({class: 'sq'+squirtExtraClass}, document.body);
    squirt.style.display = 'none';
    on('squirt.close', hideGUI);
	on('mousemove', function(){
		let sq_modal = document.querySelector('.sq .modal')
		if (sq_modal) {
			sq_modal.style.cursor = 'auto';
		}
	});		
	
    var obscure = makeDiv({class: 'sq-obscure'}, squirt);
    on(obscure, 'click', function(){
      dispatch('squirt.close');
    });

    var modal = makeDiv({'class': 'modal'}, squirt);

    var controls = makeDiv({'class':'controls'}, modal);
    var reader = makeDiv({'class': 'reader'}, modal);
    var wordContainer = makeDiv({'class': 'word-container'}, reader);
    makeDiv({'class': 'focus-indicator-gap'}, wordContainer);
    makeDiv({'class': 'word-prerenderer'}, wordContainer);
    makeDiv({'class': 'final-word'}, modal);
    var keyboard = makeDiv({'class': 'keyboard-shortcuts'}, reader);
    keyboard.innerText = "Keys: Space, Esc, Up, Down";
	
    (function makeProgressBar(){
		var progressBar = makeDiv({'id':'progress-bar','class': 'progress-bar'}, modal);
		var progressBarInner = makeDiv({'class': 'inner-bar'}, progressBar);
		var progressBarPosition = makeDiv({'id':'progress-bar-position','class': 'position'}, progressBarInner);

		on(progressBarInner, 'click', function(e){
			let elem = progressBarInner;
			let clickedAt = e.offsetX;	
			let style = window.getComputedStyle(elem, null);
			let width = parseFloat(style.getPropertyValue("width"), 10);
			let paddingLeft = parseFloat(style.getPropertyValue('padding-left'), 10);
			let paddingRight = parseFloat(style.getPropertyValue('padding-right'), 10);
			let realWidth = width-(paddingLeft+paddingRight);
			let clickedPosition = (clickedAt < paddingLeft) ? 0 : (clickedAt > realWidth) ? realWidth : clickedAt-paddingLeft;
			clickedPosition = Math.min(Math.max(parseFloat(clickedPosition), 0), realWidth);
			let percentage = (clickedPosition / realWidth * 100); 
			dispatch('squirt.seek', {percentage: percentage});
		});		
    })();	
	
    (function make(controls){

      // this code is suffering from delirium
      (function makeWPMSelect(){

        // create the ever-present left-hand side button
        var control = makeDiv({'class': 'sq wpm sq control'}, controls);
        var wpmLink = makeEl('a', {}, control);
        bind("{{wpm}} WPM", sq, wpmLink);
        on('squirt.wpm.after', wpmLink.render);
        on(control, 'click', function(){
          toggle(wpmSelector) ?
            dispatch('squirt.pause') :
            dispatch('squirt.play');
        });

        // create the custom selector
        var wpmSelector = makeDiv({'class': 'sq wpm-selector'}, controls);
        wpmSelector.style.display = 'none';
        var plus50OptData = {add: 50, sign: "+"};
        var datas = [];
        for(var wpm = 200; wpm < 1000; wpm += 100){
          var opt = makeDiv({'class': 'sq wpm-option'}, wpmSelector);
          var a = makeEl('a', {}, opt);
          a.data = { baseWPM: wpm };
          a.data.__proto__ = plus50OptData;
          datas.push(a.data);
          bind("{{wpm}}",  a.data, a);
          on(opt, 'click', function(e){
            dispatch('squirt.wpm', {value: e.target.firstChild.data.wpm});
            dispatch('squirt.play');
            wpmSelector.style.display = 'none';
          });
        };

        // create the last option for the custom selector
        var plus50Opt = makeDiv({'class': 'sq wpm-option sq wpm-plus-50'}, wpmSelector);
        var a = makeEl('a', {}, plus50Opt);
        bind("{{sign}}50", plus50OptData, a);
        on(plus50Opt, 'click', function(){
          datas.map(function(data){
            data.wpm = data.baseWPM + data.add;
          });
          var toggle = plus50OptData.sign == '+';
          plus50OptData.sign = toggle ? '-' : '+';
          plus50OptData.add = toggle ? 0 : 50;
          dispatch('squirt.els.render');
        });
        dispatch('click', {}, plus50Opt);
      })();

      (function makeRewind(){
        var container = makeEl('div', {'class': 'sq rewind sq control'}, controls);
        var a = makeEl('a', {}, container);
        a.href = '#';
        on(container, 'click', function(e){
          dispatch('squirt.rewind', {seconds: 10});
          e.preventDefault();
        });
        a.innerHTML = "<i class='fa fa-backward'></i> 10s";
      })();

      (function makePause(){
        var container = makeEl('div', {'class': 'sq pause control'}, controls);
        var a = makeEl('a', {'href': '#'}, container);
        var pauseIcon = "<i class='fa fa-pause'></i>";
        var playIcon = "<i class='fa fa-play'></i>";
        function updateIcon(){
          a.innerHTML = sq.paused ? playIcon : pauseIcon;
        }
        on('squirt.pause.after', updateIcon);
        on(container, 'click', function(clickEvt){
          dispatch('squirt.play.toggle');
          clickEvt.preventDefault();
        });
        updateIcon();
      })();
    })(controls);
  };

  function loadCookiesFrame(){
	if (document.getElementById("squirt_cookies") == null) {   
		let iframe = document.createElement('iframe');
		iframe.style.display = "none";
		iframe.setAttribute("id", "squirt_cookies");
		iframe.onload = function() {
			loadCookies();
		};		
		iframe.src = sq.cookies.loader;	
		document.body.appendChild(iframe);
	  }	
  }
   
  // utilites
  
  function map(listLike, f){
    listLike = Array.prototype.slice.call(listLike); // for safari
    return Array.prototype.map.call(listLike, f);
  }

  // invoke([f1, f2]); // calls f1() and f2()
  // invoke([o1, o2], 'func'); // calls o1.func(), o2.func()
  // args are applied to both invocation patterns
  function invoke(objs, funcName, args){
    args = args || [];
    var objsAreFuncs = false;
    switch(typeof funcName){
      case "object":
      args = funcName;
      break;
      case "undefined":
      objsAreFuncs = true;
    };
    return map(objs, function(o){
      return objsAreFuncs ? o.apply(null, args) : o[funcName].apply(o, args);
    });
  }

  function makeEl(type, attrs, parent) {
    var el = document.createElement(type);
    for(var k in attrs){
      if(!attrs.hasOwnProperty(k)) continue;
      el.setAttribute(k, attrs[k]);
    }
    parent && parent.appendChild(el);
    return el;
  };

  // data binding... *cough*
  function bind(expr, data, el){
    el.render = render.bind(null, expr, data, el);
    return on('squirt.els.render', function(){
      el.render();
    });
  };

  function render(expr, data, el){
    var match, rendered = expr;
    expr.match(/{{[^}]+}}/g).map(function(match){
      var val = data[match.substr(2, match.length - 4)];
      rendered = rendered.replace(match, val == undefined ? '' : val);
    });
    el.textContent = rendered;
  };

  function makeDiv(attrs, parent){
    return makeEl('div', attrs, parent);
  };

  function injectStylesheet(url, onLoad){
    var el = makeEl('link', {
      rel: 'stylesheet',
      href: url,
      type: 'text/css'
    }, document.head);
    function loadHandler(){
      onLoad();
      el.removeEventListener('load', loadHandler)
    };
    onLoad && on(el, 'load', loadHandler);
  };

  function on(bus, evts, cb){
    if(cb === undefined){
      cb = evts;
      evts = bus;
      bus = document;
    }
    evts = typeof evts == 'string' ? [evts] : evts;
    var removers = evts.map(function(evt){
      bus.addEventListener(evt, cb);
      return function(){
        bus.removeEventListener(evt, cb);
      };
    });
    if(removers.length == 1) return removers[0];
    return removers;
  };

  function dispatch(evt, attrs, dispatcher){
    var evt = new Event(evt);
    for(var k in attrs){
      if(!attrs.hasOwnProperty(k)) continue
      evt[k] = attrs[k];
    }
    (dispatcher || document).dispatchEvent(evt);
  };

  function toggle(el){
    var s = window.getComputedStyle(el);
    return (el.style.display = s.display == 'none' ? 'block' : 'none') == 'block';
  };

  function bindEvent(element, eventName, eventHandler) {
    if (element.addEventListener){
        element.addEventListener(eventName, eventHandler, false);
    } else if (element.attachEvent) {
        element.attachEvent('on' + eventName, eventHandler);
    }
  }    
 
  function loadCookies(){
	 if ( !sq.cookies.values ){ 
	  let cookies_iframe = document.getElementById("squirt_cookies");
	  cookies_iframe.contentWindow.postMessage({squirt_request:'getCookies'}, '*');		
	 }
  }
 
  function saveCookies(){
	let cookies_iframe = document.getElementById("squirt_cookies");
	if ( cookies_iframe && sq.cookies.values ){ 
		cookies_iframe.contentWindow.postMessage({squirt_request:'setCookies',obj:sq.cookies.values}, '*');		 
	}	
  }
})();