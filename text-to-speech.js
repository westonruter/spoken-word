/* global speechSynthesis, SpeechSynthesisUtterance */

jQuery( function( $ ) {
	var currentDeferred;

	if ( 'undefined' === typeof speechSynthesis || 'undefined' === typeof SpeechSynthesisUtterance ) {
		return;
	}
	$( document.body ).addClass( 'show-text-to-speech-controls' );

	// Stop playing when someone leaves. (Not sure why Chrome doesn't do this by default.)
	$( window ).on( 'unload', function() {
		if ( currentDeferred ) {
			currentDeferred.reject();
		}
	} );

	// @todo Chrome extension.
	// @todo Allow clicking on word to start speaking from that point, or speak selection.
	// @todo Add support for switching between languages.
	// @todo Add pitch support. currentUtterance.pitch = 2;
	// @todo Add rate support. currentUtterance.rate = 2;

	$( document.body ).on( 'click', '.text-to-speech-controls .play', function() {
		var interParagraphDelay = 500, deferred, currentUtterance, pauseBtn, stopBtn, next;
		var selection = window.getSelection();
		if ( currentDeferred ) {
			currentDeferred.reject();
		}
		deferred = $.Deferred();
		currentDeferred = deferred;
		pauseBtn = $( this ).closest( '.text-to-speech-controls' ).find( '.pause' );
		stopBtn = $( this ).closest( '.text-to-speech-controls' ).find( '.stop' );
		pauseBtn.prop( 'disabled', false );
		stopBtn.prop( 'disabled', false );

		pauseBtn.on( 'click', function() {
			if ( speechSynthesis.paused ) {
				deferred.notify( 'resume' );
			} else {
				deferred.notify( 'pause' );
			}
		} );
		stopBtn.on( 'click', function() {
			deferred.reject();
		} );

		deferred.fail( function() {
			if ( currentUtterance ) {
				speechSynthesis.cancel( currentUtterance );
				currentUtterance = null;
			}
		} );
		deferred.always( function() {
			selection.removeAllRanges();
			pauseBtn.prop( 'disabled', true );
			pauseBtn.off( 'click' );
			stopBtn.prop( 'disabled', true );
			stopBtn.off( 'click' );
		} );

		var entryContent = $( this ).closest( '.entry-content' );
		var elementQueue = entryContent.find( ':header, p, li' ).get(); // @todo Add more?

		deferred.progress( function( action ) {
			if ( 'pause' === action && currentUtterance ) {
				speechSynthesis.pause( currentUtterance );
			} else if ( 'resume' === action && currentUtterance ) {
				speechSynthesis.resume( currentUtterance );
			}
		} );

		next = function() {
			var element = elementQueue.shift(), range, walker, previousNodesOffset, currentTextNode;
			if ( ! element ) {
				deferred.resolve();
				return;
			}
			if ( 'rejected' === deferred.state() || 'resolved' === deferred.state() ) {
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

			range = document.createRange();
			walker = document.createTreeWalker( element, NodeFilter.SHOW_TEXT, null, false );
			previousNodesOffset = 0;
			currentTextNode = walker.nextNode();
			currentUtterance.onboundary = function( event ) {
				var startOffset, currentToken;
				if ( 'word' !== event.name ) {
					return;
				}
				if ( event.charIndex >= previousNodesOffset + currentTextNode.length ) {
					previousNodesOffset += currentTextNode.length;
					currentTextNode = walker.nextNode();
				}
				startOffset = event.charIndex - previousNodesOffset;

				// Handle case when resuming.
				if ( startOffset < 0 ) {
					return;
				}

				currentToken = event.currentTarget.text.substr( event.charIndex ).replace( /\W.*/, '' );
				selection.removeAllRanges();

				if ( -1 === [ '.', '!', '?' ].indexOf( currentToken ) ) {
					range.setStart( currentTextNode, startOffset );
					range.setEnd( currentTextNode, Math.min( startOffset + currentToken.length, currentTextNode.length ) );
					selection.addRange( range );
				}
			};

			currentUtterance.onend = function() {
				setTimeout( next, interParagraphDelay ); // @todo Vary by what is next, whether heading, li, or something else.
			};

			speechSynthesis.speak( currentUtterance );
		};

		next();

	} );
} );
