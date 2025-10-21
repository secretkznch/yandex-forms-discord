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
  console.log('📝 Заголовки:', JSON.stringify(req.headers, null, 2));
  console.log('📦 Тело запроса:', JSON.stringify(req.body, null, 2));
  
  try {
    // Получаем данные из form-data
    const formData = req.body;
    console.log('📊 Данные формы:', formData);
    
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

    // Добавляем поля
    for (const [key, value] of Object.entries(formData)) {
      if (value && value !== '') {
        let fieldName = key;
        if (key === 'name') fieldName = '👤 Имя';
        if (key === 'email') fieldName = '📧 Email';
        if (key === 'phone') fieldName = '📞 Телефон';
        if (key === 'message') fieldName = '💬 Сообщение';
        
        embed.fields.push({
          name: fieldName,
          value: String(value),
          inline: true
        });
      }
    }

    if (embed.fields.length === 0) {
      embed.fields.push({
        name: '⚠️ Внимание',
        value: 'Форма отправлена, но данные отсутствуют',
        inline: false
      });
    }

    const discordPayload = {
      username: 'Национальная гвардия',
      embeds: [embed]
    };

    console.log('🔄 Отправляем в Discord...');
    await axios.post(discordWebhookUrl, discordPayload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Успешно отправлено в Discord!');
    res.status(200).json({ 
      status: 'success', 
      message: 'Данные отправлены в Discord' 
    });

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    res.status(500).json({ 
      error: 'Internal Server Error',
      details: error.message 
    });
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
