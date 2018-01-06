
import { __, sprintf } from '../i18n';
import React, { Component } from 'preact-compat';
import PropTypes from 'prop-types';
import PlaybackButton from './PlaybackButton';
import { uniqueId } from '../helpers';

export default class PlaybackControls extends Component {
	componentWillMount() {
		this.idPrefix = `input${ uniqueId() }-`;
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

			selects.push(
				<p key={ presentLanguage }>
					{ sprintf( __( 'Voice (%s):' ), presentLanguage ) }
					{ ' ' }
					{
						<select
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
	 * @return {VNode|null} Settings.
	 */
	renderSettings() {
		if ( ! this.props.settingsShown ) {
			return null;
		}

		const handleNumericPropInputChange = ( event ) => {
			if ( isNaN( event.target.valueAsNumber ) || ! event.target.validity.valid ) {
				return;
			}
			this.props.setProps( {
				[ event.target.dataset.prop ]: event.target.valueAsNumber
			} );
		};

		return (
			<fieldset className="spoken-word-playback-controls__dialog">
				<legend>{ __( 'Settings' ) }</legend>
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
			</fieldset>
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
				<PlaybackButton useDashicon={ this.props.useDashicons } dashicon="admin-settings" emoji="⚙" label={ __( 'Settings' ) } onClick={ this.props.toggleSettings } pressed={ this.props.settingsShown } />

				{ this.renderSettings() }
			</fieldset>
		);
	}
}

PlaybackControls.propTypes = {
	playback: PropTypes.string.isRequired,
	play: PropTypes.func.isRequired,
	toggleSettings: PropTypes.func.isRequired,
	stop: PropTypes.func.isRequired,
	previous: PropTypes.func.isRequired,
	next: PropTypes.func.isRequired,
	useDashicons: PropTypes.bool,
	settingsShown: PropTypes.bool,
	presentLanguages: PropTypes.array.isRequired,
	availableVoices: PropTypes.array.isRequired,
	languageVoices: PropTypes.object.isRequired,
	setProps: PropTypes.func.isRequired,
};

PlaybackControls.defaultProps = {
	useDashicons: false,
};
