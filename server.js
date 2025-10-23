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

// Конфигурация для разных форм
const FORM_CONFIGS = {
  // Первая форма (документы)
  'documents': {
    webhookUrl: process.env.DISCORD_WEBHOOK_DOCUMENTS,
    title: '📋 Новый сейф документов!',
    username: 'Национальная гвардия',
    defaultRoleIds: [
      process.env.DISCORD_ROLE_DOCUMENTS_1,
      process.env.DISCORD_ROLE_DOCUMENTS_2
    ],
    fieldMapping: {
      'answer_short_text_9008960333946404': '🔢 DiscordID',
      'answer_short_text_9008960334233112': '👤 Имя и Фамилия', 
      'answer_short_text_9008960334390140': '📅 Дата рождения',
      'answer_short_text_9008960334768364': '📝 Номер паспорта',
      'answer_short_text_9008960334786320': '📷 Ксерокопия документов',
      'answer_choices_9008960334810020': '💍 Семейное положение',
      'answer_choices_9008960334862248': '⚤ Тип пола',
      'answer_short_text_9008960334876588': '📞 Номер телефона',
      'answer_short_text_9008960335425980': '📧 Электронная почта',
      'answer_short_text_9008960379742124': '📷 Фотография лица'
    }
  },
  // Вторая форма (увольнение)
  'dismissal': {
    webhookUrl: process.env.DISCORD_WEBHOOK_DISMISSAL,
    title: '🚪 Рапорт на увольнение',
    username: 'Отдел кадров',
    departmentFieldId: 'answer_choices_9008960389129240',
    departmentRoles: {
      'fpf': [process.env.DISCORD_ROLE_FPF_1],
      'ssf': [process.env.DISCORD_ROLE_SSF_1],
      'soar': [process.env.DISCORD_ROLE_SOAR_1],
      'mp': [process.env.DISCORD_ROLE_MP_1],
      'mta': [process.env.DISCORD_ROLE_MTA_1],
      'academy': [process.env.DISCORD_ROLE_ACADEMY_1]
    },
    defaultRoleIds: [process.env.DISCORD_ROLE_DISMISSAL_1, process.env.DISCORD_ROLE_DISMISSAL_2],
    fieldMapping: {
      'answer_short_text_9008960389075612': '👤 Имя и фамилия',
      'answer_short_text_9008960398320230': '🔢 DiscordID',
      'answer_short_text_9008960389101858': '📝 Номер паспорта',
      'answer_choices_9008960389129240': '🏢 Подразделение',
      'answer_short_text_9008960398199642': '📷 Фото инвентаря',
      'answer_short_text_9008960398213604': '💰 Фото оплаты неустойки',
      'answer_short_text_9008960398285328': '📋 Причина увольнения'
    }
  }
};

// Улучшенная функция для извлечения значений из Яндекс.Форм
function extractFormData(answersData, fieldMapping) {
  const formData = {};
  let discordId = null;
  let department = null;
  
  console.log('🔍 RAW answersData:', JSON.stringify(answersData, null, 2));
  
  try {
    // Формат Яндекс.Форм: answersData содержит массив полей
    if (Array.isArray(answersData)) {
      console.log('📝 Detected array format (new Yandex Forms)');
      
      for (const field of answersData) {
        if (field && field.id && fieldMapping[field.id]) {
          const fieldName = fieldMapping[field.id];
          let fieldValue = '';
          
          // Обрабатываем разные типы полей
          if (field.choices) {
            // Поле с выбором (select, radio)
            fieldValue = field.choices.labels ? field.choices.labels.join(', ') : 
                        field.choices.other || '';
          } else if (field.value) {
            // Текстовое поле
            fieldValue = field.value;
          } else if (field.text) {
            // Текстовое поле (альтернативный формат)
            fieldValue = field.text;
          }
          
          // Сохраняем Discord ID отдельно
          if (fieldName.includes('DiscordID')) {
            discordId = String(fieldValue).replace(/[@<>]/g, '');
            console.log(`🎯 Found Discord ID: ${discordId}`);
          }
          
          // Сохраняем подразделение
          if (fieldName.includes('Подразделение')) {
            department = String(fieldValue);
            console.log(`🎯 Found Department: ${department}`);
          }
          
          formData[fieldName] = String(fieldValue);
        } else if (field && field.id) {
          console.log(`⚠️ Unknown field ID: ${field.id}`);
        }
      }
    } 
    // Старый формат (вложенная структура)
    else if (answersData.answer && answersData.answer.data) {
      console.log('📝 Detected old nested format');
      const data = answersData.answer.data;
      
      for (const [fieldId, fieldData] of Object.entries(data)) {
        if (fieldData.value && fieldMapping[fieldId]) {
          let fieldValue = fieldData.value;
          
          if (Array.isArray(fieldValue)) {
            fieldValue = fieldValue.map(item => item.text || item.slug || item.key).join(', ');
            if (fieldData.value[0] && fieldData.value[0].slug) {
              department = fieldData.value[0].slug;
            }
          }
          
          const fieldName = fieldMapping[fieldId];
          if (fieldName.includes('DiscordID')) {
            discordId = String(fieldValue).replace(/[@<>]/g, '');
          }
          
          formData[fieldName] = String(fieldValue);
        }
      }
    }
    // Прямой объект
    else if (typeof answersData === 'object') {
      console.log('📝 Detected direct object format');
      for (const [fieldId, fieldData] of Object.entries(answersData)) {
        if (fieldMapping[fieldId]) {
          const fieldName = fieldMapping[fieldId];
          formData[fieldName] = String(fieldData);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error extracting form data:', error);
  }
  
  console.log('📋 Extracted formData:', formData);
  return { formData, discordId, department };
}

// Функция для получения ролей
function getDepartmentRoles(formType, department) {
  const config = FORM_CONFIGS[formType];
  
  if (formType === 'documents') {
    return config.defaultRoleIds || [];
  }
  
  if (formType === 'dismissal' && department && config.departmentRoles) {
    for (const [dept, roles] of Object.entries(config.departmentRoles)) {
      if (department.toLowerCase().includes(dept.toLowerCase())) {
        return roles;
      }
    }
  }
  
  return config.defaultRoleIds || [];
}

// Универсальный обработчик для всех форм
function createFormHandler(formType) {
  return async (req, res) => {
    console.log(`\n📨 ===== НОВЫЙ ЗАПРОС ОТ ФОРМЫ (${formType}) =====`);
    console.log('🔍 Method:', req.method);
    console.log('🔍 Headers:', req.headers);
    console.log('🔍 Full request body:', JSON.stringify(req.body, null, 2));
    
    const config = FORM_CONFIGS[formType];
    if (!config) {
      console.error(`❌ Неизвестный тип формы: ${formType}`);
      return res.status(400).json({ error: 'Unknown form type' });
    }

    if (!config.webhookUrl) {
      console.error(`❌ Webhook URL для формы ${formType} не настроен`);
      return res.status(500).json({ error: 'Server configuration error' });
    }
    
    console.log(`🌐 Using webhook: ${config.webhookUrl}`);
    
    try {
      let formData = {};
      let discordId = null;
      let department = null;
      
      // Обрабатываем разные форматы запросов от Яндекс.Форм
      if (req.body && req.body.params && req.body.params.answers) {
        console.log('📝 Detected JSON-RPC format with answers param');
        try {
          const answersData = typeof req.body.params.answers === 'string' 
            ? JSON.parse(req.body.params.answers) 
            : req.body.params.answers;
          
          console.log('📊 Parsed answers data structure:', Array.isArray(answersData) ? 'ARRAY' : 'OBJECT');
          
          const extracted = extractFormData(answersData, config.fieldMapping);
          formData = extracted.formData;
          discordId = extracted.discordId;
          department = extracted.department;
          
        } catch (parseError) {
          console.error('❌ JSON parsing error:', parseError.message);
          // Пробуем обработать как прямой объект
          const extracted = extractFormData(req.body.params.answers, config.fieldMapping);
          formData = extracted.formData;
          discordId = extracted.discordId;
          department = extracted.department;
        }
      } 
      // Прямой JSON (для тестов)
      else if (req.body && Object.keys(req.body).length > 0) {
        console.log('📝 Detected direct JSON format');
        const extracted = extractFormData(req.body, config.fieldMapping);
        formData = extracted.formData;
        discordId = extracted.discordId;
        department = extracted.department;
      } else {
        console.error('❌ Пустое тело запроса или неизвестный формат');
        formData = { '❌ Ошибка': 'Пустой запрос или неизвестный формат данных' };
      }

      // Временно: если данные пустые, показываем сырые данные для отладки
      if (Object.keys(formData).length === 0 && req.body && req.body.params && req.body.params.answers) {
        console.log('⚠️ No data extracted, showing raw data for debugging');
        const rawData = typeof req.body.params.answers === 'string' 
          ? JSON.parse(req.body.params.answers) 
          : req.body.params.answers;
        
        formData = {
          '🔍 RAW Data for Debug': JSON.stringify(rawData).substring(0, 1000) + '...'
        };
      }

      // Создаем Discord embed
      const embed = {
        title: config.title,
        color: formType === 'dismissal' ? 0xFF0000 : 0x00FF00,
        fields: [],
        timestamp: new Date().toISOString(),
        footer: { text: 'Разработчик @secretkznch' }
      };

      // Добавляем поля
      for (const [key, value] of Object.entries(formData)) {
        if (value && value !== '') {
          let displayValue = String(value);
          
          if (key.includes('DiscordID') && discordId) {
            displayValue = `<@${discordId}>`;
          }
          
          embed.fields.push({
            name: key,
            value: displayValue.substring(0, 1024),
            inline: key.length < 20
          });
        }
      }

      if (embed.fields.length === 0) {
        embed.fields.push({
          name: '⚠️ Внимание',
          value: 'Данные формы не распознаны',
          inline: false
        });
      }

      // Получаем роли для упоминания
      const roleIds = getDepartmentRoles(formType, department);
      const roleMentions = roleIds.filter(roleId => roleId).map(roleId => `<@&${roleId}>`).join(' ');

      const discordPayload = {
        username: config.username,
        content: roleMentions || 'Новая заявка!',
        embeds: [embed]
      };

      console.log(`🔄 Отправляем в Discord...`);
      console.log(`📊 Payload:`, JSON.stringify(discordPayload, null, 2));
      
      // Отправляем в Discord
      const discordResponse = await axios.post(config.webhookUrl, discordPayload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });

      console.log(`✅ Успешно отправлено в Discord! Status: ${discordResponse.status}`);
      
      // Ответ для Яндекс.Форм
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
      console.error(`❌ КРИТИЧЕСКАЯ ОШИБКА (${formType}):`, error.message);
      console.error('Stack:', error.stack);
      
      if (error.response) {
        console.error('Discord API Response:', error.response.data);
      }
      
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
  };
}

// Регистрируем эндпоинты
app.post('/webhook/documents', createFormHandler('documents'));
app.post('/webhook/dismissal', createFormHandler('dismissal'));
app.post('/webhook', createFormHandler('documents'));

// Страница проверки работы
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK 👍', 
    service: 'Яндекс.Формы → Discord',
    endpoints: {
      documents: '/webhook/documents',
      dismissal: '/webhook/dismissal',
      legacy: '/webhook'
    },
    environment: {
      hasDocumentsWebhook: !!process.env.DISCORD_WEBHOOK_DOCUMENTS,
      hasDismissalWebhook: !!process.env.DISCORD_WEBHOOK_DISMISSAL
    }
  });
});

// Проверка здоровья
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy 🏥', 
    timestamp: new Date().toISOString(),
    environment: {
      PORT: process.env.PORT || 3000,
      NODE_ENV: process.env.NODE_ENV || 'development'
    }
  });
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 Webhook для документов: http://localhost:${PORT}/webhook/documents`);
  console.log(`🔗 Webhook для увольнений: http://localhost:${PORT}/webhook/dismissal`);
  console.log(`🔍 Проверка конфигурации:`);
  console.log(`   - DISCORD_WEBHOOK_DOCUMENTS: ${process.env.DISCORD_WEBHOOK_DOCUMENTS ? '✅ Настроен' : '❌ Отсутствует'}`);
  console.log(`   - DISCORD_WEBHOOK_DISMISSAL: ${process.env.DISCORD_WEBHOOK_DISMISSAL ? '✅ Настроен' : '❌ Отсутствует'}`);
});
