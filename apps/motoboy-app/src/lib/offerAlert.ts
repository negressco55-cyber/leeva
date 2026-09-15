import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { Vibration } from 'react-native';

let audioModeReady: Promise<void> | null = null;

/** Toca mesmo com o celular no silencioso — motoboy não pode perder oferta. */
function ensureAudioMode(): Promise<void> {
  if (!audioModeReady) {
    audioModeReady = setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }
  return audioModeReady;
}

/** Vibração + som ao chegar uma oferta nova. Chamar uma vez por oferta (o
 *  chamador decide o que é "nova" — ver RideContext.setOffer). */
export function playOfferAlert(): void {
  try {
    Vibration.vibrate([0, 300, 150, 300]);
  } catch {
    /* ok, segue só com o som */
  }
  void ensureAudioMode().then(() => {
    try {
      const player = createAudioPlayer(require('../../assets/sounds/offer.wav'));
      player.play();
      setTimeout(() => {
        try {
          player.remove();
        } catch {
          /* já liberado */
        }
      }, 1500);
    } catch {
      /* sem áudio disponível neste dispositivo — a vibração já rodou */
    }
  });
}
