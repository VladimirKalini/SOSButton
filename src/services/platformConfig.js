/**
 * Конфигурация для нативных платформ (Android и iOS)
 * 
 * Этот файл содержит инструкции и код для настройки нативных платформ
 * при использовании приложения в WebView или при компиляции через Capacitor/Cordova
 */

/**
 * Инструкции для Android:
 * 
 * 1. В файле AndroidManifest.xml добавить следующие атрибуты в тег <activity>:
 * 
 * <activity 
 *   android:name=".MainActivity" 
 *   android:showWhenLocked="true" 
 *   android:turnScreenOn="true"
 *   android:exported="true">
 *   
 *   <!-- Для полноэкранных уведомлений -->
 *   <intent-filter>
 *     <action android:name="android.intent.action.MAIN" />
 *     <category android:name="android.intent.category.LAUNCHER" />
 *   </intent-filter>
 * </activity>
 * 
 * 2. В файле MainActivity.java добавить:
 * 
 * @Override
 * protected void onCreate(Bundle savedInstanceState) {
 *   super.onCreate(savedInstanceState);
 *   
 *   // Разрешаем показ поверх экрана блокировки
 *   if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
 *     setShowWhenLocked(true);
 *     setTurnScreenOn(true);
 *   } else {
 *     getWindow().addFlags(
 *       WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
 *       WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
 *     );
 *   }
 *   
 *   // Отключаем блокировку экрана во время SOS-вызова
 *   getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
 * }
 * 
 * 3. В файле NotificationService.java (или эквивалентном) для полноэкранных уведомлений:
 * 
 * private void showFullScreenNotification(String title, String message, String callId) {
 *   // Создаем Intent для открытия активности
 *   Intent fullScreenIntent = new Intent(this, MainActivity.class);
 *   fullScreenIntent.putExtra("callId", callId);
 *   fullScreenIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
 *   
 *   // Создаем PendingIntent
 *   PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(
 *     this, 0, fullScreenIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
 *   );
 *   
 *   // Настраиваем действия для кнопок
 *   Intent acceptIntent = new Intent(this, NotificationActionReceiver.class);
 *   acceptIntent.setAction("ACCEPT_CALL");
 *   acceptIntent.putExtra("callId", callId);
 *   PendingIntent acceptPendingIntent = PendingIntent.getBroadcast(
 *     this, 1, acceptIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
 *   );
 *   
 *   Intent declineIntent = new Intent(this, NotificationActionReceiver.class);
 *   declineIntent.setAction("DECLINE_CALL");
 *   declineIntent.putExtra("callId", callId);
 *   PendingIntent declinePendingIntent = PendingIntent.getBroadcast(
 *     this, 2, declineIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
 *   );
 *   
 *   // Создаем уведомление с полноэкранным Intent
 *   NotificationCompat.Builder builder = new NotificationCompat.Builder(this, "sos_channel")
 *     .setSmallIcon(R.drawable.ic_notification)
 *     .setContentTitle(title)
 *     .setContentText(message)
 *     .setPriority(NotificationCompat.PRIORITY_HIGH)
 *     .setCategory(NotificationCompat.CATEGORY_CALL)
 *     .setFullScreenIntent(fullScreenPendingIntent, true)
 *     .setSound(Uri.parse("android.resource://" + getPackageName() + "/" + R.raw.siren))
 *     .setOngoing(true)
 *     .addAction(R.drawable.ic_accept, "Принять", acceptPendingIntent)
 *     .addAction(R.drawable.ic_decline, "Отклонить", declinePendingIntent);
 *   
 *   // Показываем уведомление
 *   NotificationManagerCompat notificationManager = NotificationManagerCompat.from(this);
 *   notificationManager.notify(NOTIFICATION_ID, builder.build());
 * }
 */

/**
 * Инструкции для iOS:
 * 
 * 1. В файле AppDelegate.m добавить:
 * 
 * - (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions {
 *   // Запрашиваем разрешение на уведомления с полноэкранным режимом
 *   UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
 *   center.delegate = self;
 *   [center requestAuthorizationWithOptions:(UNAuthorizationOptionAlert | 
 *                                          UNAuthorizationOptionSound | 
 *                                          UNAuthorizationOptionBadge)
 *                        completionHandler:^(BOOL granted, NSError * _Nullable error) {
 *     if (granted) {
 *       dispatch_async(dispatch_get_main_queue(), ^{
 *         [[UIApplication sharedApplication] registerForRemoteNotifications];
 *       });
 *     }
 *   }];
 *   
 *   return YES;
 * }
 * 
 * // Для показа полноэкранных уведомлений когда приложение активно
 * - (void)userNotificationCenter:(UNUserNotificationCenter *)center 
 *        willPresentNotification:(UNNotification *)notification 
 *          withCompletionHandler:(void (^)(UNNotificationPresentationOptions))completionHandler {
 *   // Проверяем, что это SOS-уведомление
 *   NSDictionary *userInfo = notification.request.content.userInfo;
 *   if ([userInfo[@"type"] isEqualToString:@"sos"]) {
 *     // Показываем полноэкранное уведомление даже если приложение активно
 *     completionHandler(UNNotificationPresentationOptionAlert | 
 *                      UNNotificationPresentationOptionSound | 
 *                      UNNotificationPresentationOptionBadge);
 *   } else {
 *     completionHandler(UNNotificationPresentationOptionNone);
 *   }
 * }
 * 
 * // Обработка нажатия на уведомление
 * - (void)userNotificationCenter:(UNUserNotificationCenter *)center 
 *      didReceiveNotificationResponse:(UNNotificationResponse *)response 
 *               withCompletionHandler:(void (^)(void))completionHandler {
 *   NSDictionary *userInfo = response.notification.request.content.userInfo;
 *   
 *   // Проверяем действие пользователя
 *   if ([response.actionIdentifier isEqualToString:@"ACCEPT_ACTION"]) {
 *     // Обработка принятия вызова
 *     NSString *callId = userInfo[@"callId"];
 *     [[NSNotificationCenter defaultCenter] postNotificationName:@"SOSCallAccepted" 
 *                                                       object:nil 
 *                                                     userInfo:@{@"callId": callId}];
 *   } 
 *   else if ([response.actionIdentifier isEqualToString:@"DECLINE_ACTION"]) {
 *     // Обработка отклонения вызова
 *     NSString *callId = userInfo[@"callId"];
 *     [[NSNotificationCenter defaultCenter] postNotificationName:@"SOSCallDeclined" 
 *                                                       object:nil 
 *                                                     userInfo:@{@"callId": callId}];
 *   }
 *   
 *   completionHandler();
 * }
 */

/**
 * Определяет текущую платформу
 * @returns {string} 'ios', 'android' или 'web'
 */
export const getPlatform = () => {
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  
  if (/android/i.test(userAgent)) {
    return 'android';
  }
  
  if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
    return 'ios';
  }
  
  return 'web';
};

/**
 * Проверяет, запущено ли приложение в WebView
 * @returns {boolean} true, если приложение запущено в WebView
 */
export const isRunningInWebView = () => {
  const userAgent = navigator.userAgent || '';
  
  // Проверяем наличие маркеров WebView
  return /wv/.test(userAgent) || 
         /FBAN/.test(userAgent) || 
         /FBAV/.test(userAgent) ||
         /Instagram/.test(userAgent) ||
         /Capacitor/.test(userAgent) ||
         /Cordova/.test(userAgent);
};

/**
 * Проверяет, поддерживает ли устройство полноэкранные уведомления
 * @returns {boolean} true, если устройство поддерживает полноэкранные уведомления
 */
export const supportsFullScreenNotifications = () => {
  const platform = getPlatform();
  
  // На Android поддержка полноэкранных уведомлений есть начиная с Android 5.0 (API 21)
  if (platform === 'android') {
    // Определение версии Android сложно в браузере, поэтому предполагаем поддержку
    return true;
  }
  
  // На iOS полноэкранные уведомления поддерживаются начиная с iOS 10
  if (platform === 'ios') {
    // Определение версии iOS сложно в браузере, поэтому предполагаем поддержку
    return true;
  }
  
  // В вебе полноэкранных уведомлений нет
  return false;
};

/**
 * Проверяет, поддерживает ли браузер воспроизведение звука без взаимодействия с пользователем
 * @returns {boolean} true, если браузер поддерживает автовоспроизведение звука
 */
export const supportsAutoplay = async () => {
  try {
    // Создаем временный аудио-элемент
    const audio = new Audio();
    audio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
    audio.volume = 0.01; // Минимальная громкость
    
    // Пробуем воспроизвести звук
    const playResult = await audio.play().then(() => true).catch(() => false);
    
    // Останавливаем воспроизведение
    audio.pause();
    audio.src = '';
    
    return playResult;
  } catch (err) {
    console.error('Ошибка при проверке поддержки автовоспроизведения:', err);
    return false;
  }
};

/**
 * Запрашивает разрешение на показ уведомлений с учетом платформы
 * @returns {Promise<boolean>} Результат запроса разрешения
 */
export const requestPlatformNotificationPermission = async () => {
  // Для веб-браузеров используем стандартный API уведомлений
  if ('Notification' in window) {
    if (Notification.permission === 'granted') {
      return true;
    }
    
    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
  }
  
  return false;
};

export default {
  getPlatform,
  isRunningInWebView,
  supportsFullScreenNotifications,
  supportsAutoplay,
  requestPlatformNotificationPermission
}; 