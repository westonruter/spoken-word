/* global speechSynthesis, SpeechSynthesisUtterance */

jQuery( function( $ ) {
	var currentUtterance;

	if ( 'undefined' === typeof speechSynthesis || 'undefined' === typeof SpeechSynthesisUtterance ) {
		return;
	}
	$( document.body ).addClass( 'show-text-to-speech-controls' );

	// Stop playing when someone leaves. (Not sure why Chrome doesn't do this by default.)
	$( window ).on( 'unload', function() {
		if ( currentUtterance ) {
			speechSynthesis.cancel( currentUtterance );
		}
	} );

	// @todo Chrome extension.
	// @todo Allow clicking on word to start speaking from that point, or speak selection.
	// @todo Add support for switching between languages.
	// @todo Add pitch support. currentUtterance.pitch = 2;
	// @todo Add rate support. currentUtterance.rate = 2;
	$( document.body ).on( 'click', '.text-to-speech-controls .pause', function() {
		if ( currentUtterance ) {
			speechSynthesis.pause( currentUtterance );
		}
	});

	$( document.body ).on( 'click', '.text-to-speech-controls .play', function() {
		var interParagraphDelay = 500;

		if ( currentUtterance ) {
			speechSynthesis.cancel( currentUtterance );
		}

		var entryContent = $( this ).closest( '.entry-content' );

		var elementQueue = entryContent.find( 'p, li' ).get();

		var selection = window.getSelection();
		var finish = function() {
			selection.removeAllRanges();
		};

		var readNextParagraph = function() {
			var element = elementQueue.shift();
			if ( ! element ) {
				finish();
				return;
			}

			// @todo Smooth scrolling.
			if ( element.scrollIntoViewIfNeeded ) {
				element.scrollIntoViewIfNeeded();
			} else {
				element.scrollIntoView();
			}

			if ( currentUtterance ) {
				speechSynthesis.cancel( currentUtterance );
				currentUtterance = null;
			}
			currentUtterance = new SpeechSynthesisUtterance( element.textContent );

			var range = document.createRange();
			var walk = document.createTreeWalker( element, NodeFilter.SHOW_TEXT, null, false );
			var previousNodesOffset = 0;
			var currentTextNode = walk.nextNode();
			currentUtterance.onboundary = function( event ) {
				var startOffset, currentToken;
				if ( 'word' !== event.name ) {
					return;
				}
				if ( event.charIndex >= previousNodesOffset + currentTextNode.length ) {
					previousNodesOffset += currentTextNode.length;
					currentTextNode = walk.nextNode();
				}
				startOffset = event.charIndex - previousNodesOffset;
				currentToken = event.currentTarget.text.substr( event.charIndex ).replace( /\W.*/, '' );
				selection.removeAllRanges();

				if ( $.inArray( currentToken, [ '.', '!', '?' ] ) ) {
					range.setStart( currentTextNode, startOffset );
					range.setEnd( currentTextNode, Math.min( startOffset + currentToken.length, currentTextNode.length ) );
					selection.addRange( range );
				}
			};

			currentUtterance.onend = function() {
				setTimeout( readNextParagraph, interParagraphDelay );
			};

			speechSynthesis.speak( currentUtterance );
		};

		readNextParagraph();

	} );
} );
