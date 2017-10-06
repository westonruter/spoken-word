/* global speechSynthesis, SpeechSynthesisUtterance */
/* jshint es3: false, esversion: 6 */

jQuery( function( $ ) {
	let currentDeferred, voices, getVoices;

	if ( 'undefined' === typeof speechSynthesis || 'undefined' === typeof SpeechSynthesisUtterance ) {
		return;
	}

	// @todo Bookmarklet!
	// @todo LocalStorage
	document.body.classList.add( 'show-spoken-content-controls' );

	// Stop playing when someone leaves. (Not sure why Chrome doesn't do this by default.)
	window.addEventListener( 'unload', () => {
		if ( currentDeferred ) {
			currentDeferred.reject();
		}
	} );

	getVoices = function () {
		if ( voices ) {
			return voices;
		}
		voices = speechSynthesis.getVoices().filter( ( voice ) => {
			return voice.localService;
		} );
		return voices;
	};

	// @todo Allow clicking on word to start speaking from that point, or speak selection.
	// @todo Add support for switching between languages.

	// @todo Eliminate jQuery.
	$( document.body ).on( 'click', '.spoken-content-controls-advanced', function() {
		const voiceSelect = $( this ).closest( '.spoken-content-controls' ).find( '.voice' ), groups = {}, langCodes = [];
		let langCode, i;
		if ( ! voiceSelect.is( ':empty' ) ) {
			return;
		}

		getVoices().forEach( function( voice ) {
			let langCode = voice.lang.replace( /-.*/, '' );
			if ( ! groups[ langCode ] ) {
				groups[ langCode ] = [];
			}
			groups[ langCode ].push( voice );
		} );

		const addGroup = ( code ) => {
			const optgroup = document.createElement( 'optgroup' );
			optgroup.label = code;
			for ( const voice of groups[ code ] ) {
				optgroup.appendChild( new Option(
					voice.name + ' (' + voice.lang + ')',
					voice.name,
					voice['default'],
					voice['default']
				) );
			}
			voiceSelect.append( optgroup );
		};

		langCodes.push( ...Object.keys( groups ) );
		i = langCodes.indexOf( document.documentElement.lang );
		if ( -1 !== i ) {
			langCodes.splice( i, 1 );
			addGroup( document.documentElement.lang );
		}
		langCode = document.documentElement.lang.replace( /-.*/, '' );
		i = langCodes.indexOf( langCode );
		if ( -1 !== i ) {
			langCodes.splice( i, 1 );
			addGroup( langCode );
		}
		i = langCodes.indexOf( navigator.language );
		if ( -1 !== i ) {
			langCodes.splice( i, 1 );
			addGroup( navigator.language );
		}

		for ( langCode of langCodes ) {
			addGroup( langCode );
		}
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

		pauseBtn.on( 'click', () => {
			if ( speechSynthesis.paused ) {
				deferred.notify( 'resume' );
			} else {
				deferred.notify( 'pause' );
			}
		} );
		rateRange.on( 'change', () => {
			speak( currentIndex );
		} );
		pitchRange.on( 'change', () => {
			speak( currentIndex );
		} );
		voiceSelect.on( 'change', () => {
			speak( currentIndex );
		} );
		stopBtn.on( 'click', () => {
			deferred.reject();
		} );

		deferred.fail( () => {
			if ( currentUtterance ) {
				speechSynthesis.cancel( currentUtterance );
				currentUtterance = null;
			}
		} );
		deferred.always( () => {
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

		previousBtn.on( 'click', () => {
			currentIndex = Math.max( 0, currentIndex - 1 );
			speak( currentIndex );
		} );
		nextBtn.on( 'click', () => {
			currentIndex++;
			speak( currentIndex );
		} );

		deferred.progress( ( action ) => {
			if ( 'pause' === action && currentUtterance ) {
				speechSynthesis.pause( currentUtterance );
			} else if ( 'resume' === action && currentUtterance ) {
				speechSynthesis.resume( currentUtterance );
			}
		} );

		// @todo Let there be an index.
		speak = ( index ) => {
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
				currentUtterance.voice = getVoices().find( ( voice ) => {
					return voiceSelect.val() === voice.name;
				} ) || null;
			}

			// Make sure the right language is used.
			if ( currentUtterance.voice && currentUtterance.voice.lang !== langCountryCode && currentUtterance.voice.lang.replace( /-.*/, '' ) !== langCode ) {
				currentUtterance.voice = getVoices().find( ( voice ) => {
					return voice.lang === langCountryCode;
				} ) || null;

				// Try just language without country.
				if ( ! currentUtterance.voice ) {
					currentUtterance.voice = getVoices().find( ( voice ) => {
						return voice.lang.replace( /-.*/, '' ) === langCode;
					} );
				}
			}

			range = document.createRange();
			walker = document.createTreeWalker( element, NodeFilter.SHOW_TEXT, null, false );
			previousNodesOffset = 0;
			currentTextNode = walker.nextNode();
			currentUtterance.onboundary = ( event ) => {
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

			currentUtterance.onend = () => {
				currentIndex++;
				setTimeout( () => {
					speak( currentIndex );
				}, interParagraphDelay * ( 1 / parseFloat( rateRange.prop( 'value' ) ) ) ); // @todo Vary by what is next, whether heading, li, or something else.
			};

			speechSynthesis.speak( currentUtterance );
		};

		speak( currentIndex );

	} );
} );
