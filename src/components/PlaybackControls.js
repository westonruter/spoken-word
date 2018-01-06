/* global dialogPolyfill */

import { __, sprintf } from '../i18n';
import React, { Component } from 'preact-compat';
import PropTypes from 'prop-types';
import PlaybackButton from './PlaybackButton';
import { uniqueId } from '../helpers';

export default class PlaybackControls extends Component {
	componentWillMount() {
		this.idPrefix = `input${ uniqueId() }-`;
	}

	componentDidMount() {
		this.updateDialogState();
		if ( ! this.dialog.showModal && typeof dialogPolyfill !== 'undefined' ) {
			dialogPolyfill.registerDialog( this.dialog );
		}
		this.dialog.addEventListener( 'cancel', ( event ) => {
			event.preventDefault();
			this.props.onHideSettings();
		} );
	}

	componentDidUpdate() {
		this.updateDialogState();
	}

	/**
	 * Update dialog state.
	 */
	updateDialogState() {
		if ( ! this.props.settingsShown && this.dialog.open ) {
			this.dialog.close();
			if ( this.previousActiveElement && 'playing' !== this.props.playback ) {
				this.previousActiveElement.focus();
			}
		} else if ( this.props.settingsShown && ! this.dialog.open ) {
			this.previousActiveElement = document.activeElement;
			this.dialog.showModal();
		}
	}

	/**
	 * Render language voice select dropdowns.
	 *
	 * @return {VNode[]|null} Elements or null if no available voices or no present languages.
	 */
	renderLanguageVoiceSelects() {
		if ( 0 === this.props.availableVoices.length || 0 === this.props.presentLanguages.length ) {
			return null;
		}

		const updateLanguageVoice = ( event ) => {
			const languageVoices = Object.assign(
				{},
				this.props.languageVoices,
				{
					[ event.target.dataset.language ]: event.target.value,
				}
			);
			this.props.setProps( { languageVoices } );
		};

		const selects = [];
		for ( const presentLanguage of this.props.presentLanguages ) {
			const voicesInLanguage = this.props.availableVoices.filter(
				( voice ) => voice.lang.startsWith( presentLanguage )
			);
			if ( 0 === voicesInLanguage.length ) {
				continue;
			}

			const id = this.idPrefix + 'voice-' + presentLanguage;
			selects.push(
				<p key={ presentLanguage }>
					<label htmlFor={ id }>
						{ sprintf( __( 'Voice (%s):' ), presentLanguage ) }
					</label>
					{ ' ' }
					{
						<select
							id={ id }
							data-language={ presentLanguage }
							value={ this.props.languageVoices[ presentLanguage ] }
							onBlur={ updateLanguageVoice }
							onChange={ updateLanguageVoice }
						>
							{ voicesInLanguage.map(
								( voice ) =>
									<option key={ voice.voiceURI } value={ voice.voiceURI }>
										{ voice.lang.includes( '-' ) ?
											sprintf( __( '%s (%s)' ), voice.name, voice.lang ) :
											voice.name }
									</option>
							) }
						</select>
					}
				</p>
			);
		}

		return selects;
	}

	/**
	 * Render settings.
	 *
	 * @returns {VNode|null} Settings.
	 */
	renderSettings() {
		if ( ! this.props.isDialogSupported ) {
			return null;
		}

		const saveDialogRef = ( dialog ) => {
			this.dialog = dialog;
		};
		const handleNumericPropInputChange = ( event ) => {
			if ( isNaN( event.target.valueAsNumber ) || ! event.target.validity.valid ) {
				return;
			}
			this.props.setProps( {
				[ event.target.dataset.prop ]: event.target.valueAsNumber,
			} );
		};

		return (
			<dialog className="spoken-word-playback-controls__dialog" ref={ saveDialogRef }>
				<p>
					<label htmlFor={ this.idPrefix + 'rate' }>{ __( 'Rate:' ) }</label>
					{ ' ' }
					<input
						id={ this.idPrefix + 'rate' }
						type="number"
						data-prop="rate"
						value={ this.props.rate }
						step={ 0.1 }
						min={ 0.1 }
						max={ 10 }
						onChange={ handleNumericPropInputChange }
					/>
				</p>
				<p>
					<label htmlFor={ this.idPrefix + 'pitch' }>{ __( 'Pitch:' ) }</label>
					{ ' ' }
					<input
						id={ this.idPrefix + 'pitch' }
						type="number"
						data-prop="pitch"
						value={ this.props.pitch }
						min={ 0 }
						max={ 2 }
						step={ 0.1 }
						onChange={ handleNumericPropInputChange }
					/>
				</p>
				{ this.renderLanguageVoiceSelects() }
				<button onClick={ this.props.onHideSettings }>{ __( 'Close' ) }</button>
			</dialog>
		);
	}

	/**
	 * Render.
	 *
	 * @return {VNode} Element.
	 */
	render() {
		const classNames = [ 'spoken-word-playback-controls' ];
		const isPlaying = 'playing' === this.props.playback;

		return (
			<fieldset className={ classNames.join( ' ' ) }>
				<legend className="spoken-word-playback-controls__legend">{ __( 'Text to Speech' ) }</legend>

				<PlaybackButton
					useDashicon={ this.props.useDashicons }
					dashicon={ isPlaying ? 'controls-pause' : 'controls-play' }
					emoji={ isPlaying ? '⏸️' : '▶' }
					label={ isPlaying ? __( 'Pause' ) : __( 'Play' ) }
					onClick={ isPlaying ? this.props.stop : this.props.play }
				/>

				<PlaybackButton useDashicon={ this.props.useDashicons } dashicon="controls-back" emoji="⏪" label={ __( 'Previous' ) } onClick={ this.props.previous } />
				<PlaybackButton useDashicon={ this.props.useDashicons } dashicon="controls-forward" emoji="⏩" label={ __( 'Forward' ) } onClick={ this.props.next } />
				{ this.props.isDialogSupported ?
					<PlaybackButton useDashicon={ this.props.useDashicons } dashicon="admin-settings" emoji="⚙" label={ __( 'Settings' ) } onClick={ this.props.onShowSettings } /> : '' }
				{ this.renderSettings() }
			</fieldset>
		);
	}
}

PlaybackControls.propTypes = {
	playback: PropTypes.string.isRequired,
	play: PropTypes.func.isRequired,
	onShowSettings: PropTypes.func.isRequired,
	onHideSettings: PropTypes.func.isRequired,
	stop: PropTypes.func.isRequired,
	previous: PropTypes.func.isRequired,
	next: PropTypes.func.isRequired,
	useDashicons: PropTypes.bool,
	settingsShown: PropTypes.bool,
	isDialogSupported: PropTypes.bool,
	presentLanguages: PropTypes.array.isRequired,
	availableVoices: PropTypes.array.isRequired,
	languageVoices: PropTypes.object.isRequired,
	setProps: PropTypes.func.isRequired,
};

PlaybackControls.defaultProps = {
	useDashicons: false,
};
