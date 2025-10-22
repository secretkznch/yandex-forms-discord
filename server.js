const express = require('express');
const axios = require('axios');

const app = express();

// Обрабатываем оба формата: JSON и form-data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Разрешаем запросы от Яндекс.Форм
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Функция для извлечения значений из сложной структуры Яндекс.Форм
function extractFormData(answersData) {
  const formData = {};
  let discordId = null;
  
  if (answersData.answer && answersData.answer.data) {
    const data = answersData.answer.data;
    
    // Сопоставление ID полей с человекочитаемыми названиями
    const fieldMapping = {
      'answer_short_text_9008960333946404': '🔢 DiscordID',
      'answer_short_text_9008960334233112': '👤 Имя и Фамилия', 
      'answer_short_text_9008960334390140': '📅 Дата рождения',
      'answer_short_text_9008960334768364': '📝 Номер паспорта',
      'answer_short_text_9008960334786320': '📷 Ксерокопия документов',
      'answer_choices_9008960334810020': '💍 Семейное положение',
      'answer_choices_9008960334862248': '⚤ Тип пола',
      'answer_short_text_9008960334876588': '📞 Номер телефона',
      'answer_short_text_9008960335425980': '📧 Электронная почта'
    };
    
    // Обрабатываем каждое поле
    for (const [fieldId, fieldData] of Object.entries(data)) {
      if (fieldData.value) {
        let fieldValue = fieldData.value;
        
        // Обрабатываем выбор из списка
        if (Array.isArray(fieldValue)) {
          fieldValue = fieldValue.map(item => item.text || item.slug || item.key).join(', ');
        }
        
        // Сохраняем Discord ID отдельно для упоминания
        if (fieldId === 'answer_short_text_9008960333946404') {
          discordId = String(fieldValue).replace('@', ''); // Убираем @ если есть
        }
        
        // Берем человекочитаемое название или используем ID
        const fieldName = fieldMapping[fieldId] || fieldId;
        formData[fieldName] = String(fieldValue);
      }
    }
  }
  
  return { formData, discordId };
}

// Главный обработчик для Яндекс.Форм
app.post('/webhook', async (req, res) => {
  console.log('📨 Получен запрос от Яндекс.Формы');
  
  try {
    let formData = {};
    let discordId = null;
    
    // Обрабатываем JSON-RPC формат от Яндекс.Форм
    if (req.body && req.body.params && req.body.params.answers) {
      try {
        // Парсим JSON из answers
        const answersData = JSON.parse(req.body.params.answers);
        console.log('📊 Ответы формы:', JSON.stringify(answersData, null, 2));
        
        // Извлекаем данные
        const extracted = extractFormData(answersData);
        formData = extracted.formData;
        discordId = extracted.discordId;
        console.log('📋 Обработанные данные:', formData);
        console.log('🆔 Discord ID для упоминания:', discordId);
        
      } catch (parseError) {
        console.error('❌ Ошибка парсинга JSON:', parseError.message);
        formData = { '❌ Ошибка': 'Не удалось обработать данные формы' };
      }
    } else {
      // Обычный JSON запрос
      formData = req.body;
      console.log('📊 Данные формы:', formData);
    }
    
    const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;

    if (!discordWebhookUrl) {
      console.error('❌ Ошибка: DISCORD_WEBHOOK_URL не настроен');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const embed = {
      title: '📋 Новый сейф документов!',
      color: 0x00FF00,
      fields: [],
      timestamp: new Date().toISOString(),
      footer: {
        text: 'Яндекс.Формы → Discord'
      }
    };

    // Добавляем поля в Discord сообщение
    for (const [key, value] of Object.entries(formData)) {
      if (value && value !== '') {
        let displayValue = String(value);
        
        // Заменяем значение DiscordID на упоминание
        if (key === '🔢 DiscordID' && discordId) {
          displayValue = `<@${discordId}>`;
        }
        
        embed.fields.push({
          name: key,
          value: displayValue.substring(0, 1024), // Ограничение Discord
          inline: key.length < 20
        });
      }
    }

    // Если нет данных
    if (embed.fields.length === 0) {
      embed.fields.push({
        name: '⚠️ Внимание',
        value: 'Данные формы не распознаны. Проверьте настройки.',
        inline: false
      });
    }

    // ID ролей для упоминания (замени на реальные ID ролей)
    const ROLE_IDS = {
      ROLE_1: process.env.DISCORD_ROLE_1 || '1235694403436286064', // Первая роль
      ROLE_2: process.env.DISCORD_ROLE_2 || '1235694409698381916'  // Вторая роль
    };

    // Создаем упоминания ролей
    const roleMentions = `<@&${ROLE_IDS.ROLE_1}> <@&${ROLE_IDS.ROLE_2}>`;

    const discordPayload = {
      username: 'Национальная гвардия',
      content: roleMentions, // Упоминание ролей в начале сообщения
      embeds: [embed]
    };

    console.log('🔄 Отправляем в Discord...');
    console.log(`👥 Упоминаем роли: ${roleMentions}`);
    
    const discordResponse = await axios.post(discordWebhookUrl, discordPayload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Успешно отправлено в Discord!');
    
    // Возвращаем правильный JSON-RPC ответ
    if (req.body && req.body.jsonrpc) {
      res.status(200).json({
        jsonrpc: "2.0",
        id: req.body.id || null,
        result: { status: "success" }
      });
    } else {
      res.status(200).json({ 
        status: 'success', 
        message: 'Данные отправлены в Discord' 
      });
    }

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    
    // JSON-RPC error response
    if (req.body && req.body.jsonrpc) {
      res.status(500).json({
        jsonrpc: "2.0",
        id: req.body.id || null,
        error: { message: error.message }
      });
    } else {
      res.status(500).json({ 
        error: 'Internal Server Error',
        details: error.message 
      });
    }
  }
});

// Страница проверки работы
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK 👍', 
    service: 'Яндекс.Формы → Discord',
    instruction: 'Отправьте POST запрос на /webhook с данными формы'
  });
});

// Проверка здоровья
app.get('/health', (req, res) => {
  res.json({ status: 'healthy 🏥', timestamp: new Date().toISOString() });
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 Webhook URL: http://localhost:${PORT}/webhook`);
});
