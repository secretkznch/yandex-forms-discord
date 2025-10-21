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

// Главный обработчик для Яндекс.Форм
app.post('/webhook', async (req, res) => {
  console.log('📨 Получен запрос от Яндекс.Формы');
  
  try {
    let formData = {};
    
    // Обрабатываем JSON-RPC формат от Яндекс.Форм
    if (req.body && req.body.params && req.body.params.answers) {
      try {
        // Парсим сложный JSON из answers
        const answersData = JSON.parse(req.body.params.answers);
        console.log('📊 Ответы формы:', answersData);
        
        // Извлекаем данные из сложной структуры
        if (answersData.answer && answersData.answer.data) {
          const data = answersData.answer.data;
          
          // Создаем понятные названия полей
          const fieldMapping = {
            'answer_short_text_9008960333946404': '🔢 Номер',
            'answer_short_text_9008960334233112': '👤 Имя пользователя', 
            'answer_short_text_9008960334390140': '📷 Фото 1',
            'answer_short_text_9008960334768364': '💰 Сумма',
            'answer_short_text_9008960334786320': '📷 Фото 2',
            'answer_choices_9008960334810020': '💍 Семейное положение',
            'answer_choices_9008960334862248': '🏠 Тип пола',
            'answer_short_text_9008960334876588': '📞 Телефон',
            'answer_short_text_9008960335425980': '📧 Email'
          };
          
          // Преобразуем данные в понятный формат
          for (const [key, valueObj] of Object.entries(data)) {
            if (valueObj.value) {
              let fieldValue = valueObj.value;
              
              // Обрабатываем массивы (выбор из списка)
              if (Array.isArray(fieldValue)) {
                fieldValue = fieldValue.map(item => item.text || item.slug || item.key).join(', ');
              }
              
              const fieldName = fieldMapping[key] || key;
              formData[fieldName] = fieldValue;
            }
          }
        }
        
        console.log('📋 Обработанные данные:', formData);
        
      } catch (parseError) {
        console.error('❌ Ошибка парсинга JSON:', parseError.message);
        formData = { error: 'Не удалось обработать данные формы' };
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
      if (value && value !== '' && key !== 'jsonrpc' && key !== 'id') {
        embed.fields.push({
          name: key,
          value: String(value).substring(0, 1024), // Ограничение Discord
          inline: key.length < 20
        });
      }
    }

    if (embed.fields.length === 0) {
      embed.fields.push({
        name: '⚠️ Внимание',
        value: 'Форма отправлена, но данные отсутствуют или не распознаны',
        inline: false
      });
    }

    const discordPayload = {
      username: 'Национальная гвардия',
      embeds: [embed]
    };

    console.log('🔄 Отправляем в Discord...');
    console.log('📤 Discord payload:', JSON.stringify(discordPayload, null, 2));
    
    const discordResponse = await axios.post(discordWebhookUrl, discordPayload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    console.log('✅ Успешно отправлено в Discord! Status:', discordResponse.status);
    
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
    if (error.response) {
      console.error('📨 Ответ Discord:', error.response.data);
    }
    
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
