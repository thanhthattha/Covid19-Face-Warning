import React, { useEffect, useRef, useState } from 'react';
import { initNotifications, notify } from '@mycv/f8-notification';
import * as tf from '@tensorflow/tfjs';
import { Howl } from 'howler';
import * as mobilenet from "@tensorflow-models/mobilenet";
import * as knnClassifier from "@tensorflow-models/knn-classifier";
import soundURL from './assets/hey_sondn.mp3';
import './App.css';

var sound = new Howl({
  src: [soundURL]
});

const NOT_TOUCH_LABEL = 'not_touch';
const TOUCHED_LABEL = 'touched';
const TRAINING_TIMES = 50;
const TOUCHED_CONFIDENCE = 0.8;

function App() {
  const video = useRef();
  const classifier = useRef();
  const mobilenetModule = useRef(true);
  const canPlaySound = useRef(true);
  const [touched, setTouched] = useState(false);

  const init = async () => {
    console.log('init...');
    await setupCamera();
    console.log('setup camera successfully');

    classifier.current = knnClassifier.create();

    mobilenetModule.current = await mobilenet.load();

    console.log('setup done');
    alert('Không chạm tay lên mặt và ấn Train 1 | Chờ khoảng 5s và sau đó ấn tiếp vào Train 2');

    initNotifications({ cooldown: 3000 });
  }

  const setupCamera = () => {
    return new Promise((resolve, reject) => {
      navigator.getUserMedia = navigator.getUserMedia ||
        navigator.webkitGetUserMedia ||
        navigator.mozBetUserMedia ||
        navigator.msGetUserMedia;

      if(navigator.getUserMedia) {
        navigator.getUserMedia(
          { video: true },
          stream => {
            video.current.srcObject = stream;
            video.current.addEventListener('loadeddata', resolve);
          },
          error => reject(error)
        )
      } else {
        reject();
      }
    });
  }

  const train = async label => {
    console.log(`[${label}]  Đang train cho máy mặt đẹp trai của bạn`);
    for (let i = 0; i < TRAINING_TIMES; ++i) {
      console.log(`Progress ${parseInt((i+1) / TRAINING_TIMES * 100)}%`);

      await training(label);
    }
  }

  /**
   * Bước 1: train cho máy khuôn mặt ko chạm tay
   * Bước 2: train cho máy khuôn mặt có chạm tay
   * Bước 3: lấy hình ảnh hiện tại, phân tích và so sánh với data đã học
   * --> Nếu mà nó matching với data khuôn mặt chạm tay -> cảnh báo
   * @param {*} label
   */

  const training = label => {
    return new Promise(async resolve => {
      const embedding = mobilenetModule.current.infer(
        video.current,
        true
      );
      classifier.current.addExample(embedding, label);
      await sleep(100);
      resolve();
    });
  }

  const run = async () => {
    const embedding = mobilenetModule.current.infer(
      video.current,
      true
    );
    const result = await classifier.current.predictClass(embedding);

    if (
      result.label === TOUCHED_LABEL &&
      result.confidences[result.label] > TOUCHED_CONFIDENCE
      ) {
      console.log('Touched');
      if (canPlaySound.current) {
        sound.play();
        canPlaySound.current = false;
      }
      notify('Bỏ tay ra', { body: 'Bạn vừa chạm tay lên mặt.' });
      setTouched(true);
    } else {
      console.log('Not touch')
      setTouched(false);
    }

    await sleep(200);

    run();
  }

  const sleep = (ms = 0) => {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  useEffect(() => {
    init();

    sound.on('end', function(){
      canPlaySound.current = true;
    });

    // cleanup
    return () => {

    }
  }, []);

  return (
    <div className={`main ${touched ? 'touched' : ''}`}>
      <video
        ref={video}
        className="video"
        autoPlay
      />

      <div className="control">
        <button className="btn" onClick={() => train(NOT_TOUCH_LABEL)}>Train 1</button>
        <button className="btn" onClick={() => train(TOUCHED_LABEL)}>Train 2</button>
        <button className="btn" onClick={() => run()}>Run</button>
      </div>
    </div>
  );
}

export default App;
