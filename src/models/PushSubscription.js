/**
 * Клиентская модель для работы с Push-подписками
 * Используется для типизации и работы с данными подписок на фронтенде
 */

/**
 * @typedef {Object} PushSubscription
 * @property {string} endpoint - URL для отправки push-уведомлений
 * @property {Object} keys - Ключи для шифрования данных
 * @property {string} keys.p256dh - Публичный ключ
 * @property {string} keys.auth - Ключ авторизации
 */

/**
 * @typedef {Object} PushSubscriptionModel
 * @property {string} _id - ID подписки в базе данных
 * @property {string} userId - ID пользователя
 * @property {PushSubscription} subscription - Объект подписки
 * @property {string} userAgent - User-Agent браузера
 * @property {Date} createdAt - Дата создания
 * @property {Date} updatedAt - Дата обновления
 */

export default class PushSubscriptionClient {
  /**
   * Создает новый объект подписки
   * @param {Object} data - Данные подписки
   */
  constructor(data = {}) {
    this._id = data._id || null;
    this.userId = data.userId || null;
    this.subscription = data.subscription || null;
    this.userAgent = data.userAgent || navigator.userAgent;
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
  }

  /**
   * Преобразует объект в JSON для отправки на сервер
   * @returns {Object} Объект для JSON.stringify
   */
  toJSON() {
    return {
      _id: this._id,
      userId: this.userId,
      subscription: this.subscription,
      userAgent: this.userAgent
    };
  }

  /**
   * Создает объект из данных, полученных с сервера
   * @param {Object} data - Данные с сервера
   * @returns {PushSubscriptionClient} Новый объект подписки
   */
  static fromJSON(data) {
    return new PushSubscriptionClient(data);
  }
} 