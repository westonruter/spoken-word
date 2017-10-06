/* global speechSynthesis, SpeechSynthesisUtterance */

jQuery( function( $ ) {
	var currentDeferred, voices, getVoices;

	if ( 'undefined' === typeof speechSynthesis || 'undefined' === typeof SpeechSynthesisUtterance ) {
		return;
	}

	// @todo Bookmarklet!
	// @todo LocalStorage
	$( document.body ).addClass( 'show-spoken-content-controls' );

	// Stop playing when someone leaves. (Not sure why Chrome doesn't do this by default.)
	$( window ).on( 'unload', function() {
		if ( currentDeferred ) {
			currentDeferred.reject();
		}
	} );

	getVoices = function () {
		if ( voices ) {
			return voices;
		}
		voices = speechSynthesis.getVoices();
		return voices;
	};

	// @todo Allow clicking on word to start speaking from that point, or speak selection.
	// @todo Add support for switching between languages.

	$( document.body ).on( 'click', '.spoken-content-controls-advanced', function() {
		var voiceSelect = $( this ).closest( '.spoken-content-controls' ).find( '.voice' );
		if ( ! voiceSelect.is( ':empty' ) ) {
			return;
		}

		// @todo Option groups.
		$.each( getVoices(), function() {
			if ( this.localService ) {
				voiceSelect.append( new Option(
					this.name + ' (' + this.lang + ')',
					this.name,
					this['default']
				) );
			}
		} );
	} );

	$( document.body ).on( 'click', '.spoken-content-controls .play', function() {
		var interParagraphDelay = 500, currentIndex = 0, deferred, currentUtterance, pauseBtn, voiceSelect, stopBtn, nextBtn, previousBtn, rateRange, pitchRange, speak, selection, entryContent, elementQueue;
		selection = window.getSelection();
		if ( currentDeferred ) {
			currentDeferred.reject();
		}
		deferred = $.Deferred();
		currentDeferred = deferred;
		pauseBtn = $( this ).closest( '.spoken-content-controls' ).find( '.pause' );
		nextBtn = $( this ).closest( '.spoken-content-controls' ).find( '.next' );
		previousBtn = $( this ).closest( '.spoken-content-controls' ).find( '.previous' );
		stopBtn = $( this ).closest( '.spoken-content-controls' ).find( '.stop' );
		rateRange = $( this ).closest( '.spoken-content-controls' ).find( '.rate' );
		pitchRange = $( this ).closest( '.spoken-content-controls' ).find( '.pitch' );
		voiceSelect = $( this ).closest( '.spoken-content-controls' ).find( '.voice' );
		pauseBtn.prop( 'disabled', false );
		previousBtn.prop( 'disabled', false );
		nextBtn.prop( 'disabled', false );
		stopBtn.prop( 'disabled', false );

		pauseBtn.on( 'click', function() {
			if ( speechSynthesis.paused ) {
				deferred.notify( 'resume' );
			} else {
				deferred.notify( 'pause' );
			}
		} );
		rateRange.on( 'change', function() {
			speak( currentIndex );
		} );
		pitchRange.on( 'change', function() {
			speak( currentIndex );
		} );
		voiceSelect.on( 'change', function() {
			speak( currentIndex );
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
			stopBtn.prop( 'disabled', true );
			previousBtn.prop( 'disabled', true );
			nextBtn.prop( 'disabled', true );
			pauseBtn.off( 'click' );
			stopBtn.off( 'click' );
			nextBtn.off( 'click' );
			previousBtn.off( 'click' );
			rateRange.off( 'change' );
			pitchRange.off( 'change' );
			voiceSelect.off( 'change' );
		} );

		entryContent = $( this ).closest( '.entry-content' );
		elementQueue = entryContent.find( ':header, p, li' ).get(); // @todo Add more?

		previousBtn.on( 'click', function() {
			currentIndex = Math.max( 0, currentIndex - 1 );
			speak( currentIndex );
		} );
		nextBtn.on( 'click', function() {
			currentIndex++;
			speak( currentIndex );
		} );

		deferred.progress( function( action ) {
			if ( 'pause' === action && currentUtterance ) {
				speechSynthesis.pause( currentUtterance );
			} else if ( 'resume' === action && currentUtterance ) {
				speechSynthesis.resume( currentUtterance );
			}
		} );

		// @todo Let there be an index.
		speak = function( index ) {
			var element, range, walker, previousNodesOffset, currentTextNode, langCountryCode, langCode, defaultVoice;
			element = elementQueue[ index ];
			if ( ! element ) {
				deferred.resolve();
				return;
			}
			if ( 'rejected' === deferred.state() || 'resolved' === deferred.state() ) {
				return;
			}
			langCountryCode = element.lang || document.documentElement.lang; // @todo Recursively look?
			langCode = langCountryCode.replace( /-.*/, '' );

			// @todo Let this be in the footer fixed when playing?
			// @todo Smooth scrolling.
			// if ( element.scrollIntoViewIfNeeded ) {
			// 	element.scrollIntoViewIfNeeded();
			// } else {
			// 	element.scrollIntoView();
			// }

			if ( currentUtterance ) {
				currentUtterance.onend = null;
				speechSynthesis.cancel( currentUtterance );
				currentUtterance = null;
			}
			currentUtterance = new SpeechSynthesisUtterance( element.textContent );
			currentUtterance.pitch = parseFloat( pitchRange.prop( 'value' ) );
			currentUtterance.rate = parseFloat( rateRange.prop( 'value' ) );

			defaultVoice = getVoices().find( function( voice ) {
				return voice['default'];
			} );

			currentUtterance.voice = defaultVoice;
			if ( voiceSelect.val() ) {
				currentUtterance.voice = getVoices().find( function( voice ) {
					return voiceSelect.val() === voice.name;
				} ) || null;
			}

			// Make sure the right language is used.
			if ( currentUtterance.voice && currentUtterance.voice.lang !== langCountryCode ) {
				currentUtterance.voice = getVoices().find( function( voice ) {
					return voice.lang === langCountryCode;
				} ) || null;

				// Try just language without country.
				if ( ! currentUtterance.voice ) {
					currentUtterance.voice = getVoices().find( function( voice ) {
						return voice.lang.replace( /-.*/, '' ) === langCode;
					} );
				}
			}

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
				currentIndex++;
				setTimeout( function() {
					speak( currentIndex );
				}, interParagraphDelay * ( 1 / parseFloat( rateRange.prop( 'value' ) ) ) ); // @todo Vary by what is next, whether heading, li, or something else.
			};

			speechSynthesis.speak( currentUtterance );
		};

		speak( currentIndex );

	} );
} );
