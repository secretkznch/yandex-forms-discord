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
  },
  // Жетоны генералитета
  'gentoken': {
    webhookUrl: process.env.DISCORD_WEBHOOK_GENTOKEN,
    title: 'Новый жетон',
    username: 'Генеральский Штаб SANG',
    defaultRoleIds: [], // пустой массив для сообщении без упоминаний ролей
    fieldMapping: {
      'answer_short_text_9008960646964800': '🔢 DiscordID',
      'answer_short_text_9008960646979296': '👤 Имя и Фамилия',
      'answer_short_text_9008960647009660': '👨🏻‍✈️ Должность',
      'answer_short_text_9008960647031964': '🎫 Жетон'
    }
  },
  // Заявка на получение военного билета
  'voennik': {
    webhookUrl: process.env.DISCORD_WEBHOOK_VOENNIK,
    title: 'Заявление на получение военного билета',
    username: 'Национальная гвардия штата Сан-Андреас',
    defaultRoleIds: [process.env.DISCORD_ROLE_DISMISSAL_1, process.env.DISCORD_ROLE_DISMISSAL_2],
    fieldMapping: {
      'answer_short_text_9008961500031128': '🔢 DiscordID',
      'answer_short_text_9008961500298774': '👤 Имя и Фамилия',
      'answer_short_text_9008961500309430': '📝 Номер паспорта',
      'answer_short_text_9008961500334300': '📋 Примерная дата подписания контракта',
      'answer_short_text_9008961500346004': '👨🏻‍✈️ Воинское звание',
      'answer_choices_9008961500375596': '📝 Причина подачи заявление',
      'answer_choices_9008961500770008': '📂 Активность'
    }
  },
  // Разрешение на перевод
  'dismissal': {
    webhookUrl: process.env.DISCORD_WEBHOOK_PEREVOD_1,
    title: '📑 Разрешение на перевод',
    username: 'Отдел кадров',
    departmentFieldId: 'answer_choices_9008961512180258',
    departmentRoles: {
      'fpf': [process.env.DISCORD_ROLE_FPF_1],
      'ssf': [process.env.DISCORD_ROLE_SSF_1],
      'soar': [process.env.DISCORD_ROLE_SOAR_1],
      'mp': [process.env.DISCORD_ROLE_MP_1],
      'mta': [process.env.DISCORD_ROLE_MTA_1],
    },
    departmentFieldId: 'answer_choices_9008961518712384',
    departmentRoles: {
      'fpf': [process.env.DISCORD_ROLE_FPF_1],
      'ssf': [process.env.DISCORD_ROLE_SSF_1],
      'soar': [process.env.DISCORD_ROLE_SOAR_1],
      'mp': [process.env.DISCORD_ROLE_MP_1],
      'mta': [process.env.DISCORD_ROLE_MTA_1],
    },
    defaultRoleIds: [process.env.DISCORD_ROLE_DISMISSAL_1, process.env.DISCORD_ROLE_DISMISSAL_2],
    fieldMapping: {
      'answer_short_text_9008961503377904': '🔢 DiscordID',
      'answer_short_text_9008961503405112': '👤 Имя и фамилия',
      'answer_short_text_9008961503423628': '👨🏻‍✈️ Воинское звание',
      'answer_choices_9008961512180258': '🏢 Текущее подразделение',
      'answer_choices_9008961518712384': '🏢 Желаемое подразделение',
      'answer_short_text_9008961512272368': '📋 Причина желания перевода'
    }
  },
};

// Улучшенная функция для извлечения значений из Яндекс.Форм
function extractFormData(answersData, fieldMapping) {
  const formData = {};
  let discordId = null;
  let department = null;
  
  console.log('🔍 RAW answersData:', JSON.stringify(answersData, null, 2));
  
  try {
    // Обрабатываем структуру Яндекс.Форм с answer.data
    if (answersData.answer && answersData.answer.data) {
      console.log('📝 Detected Yandex Forms structure with answer.data');
      const data = answersData.answer.data;
      
      for (const [fieldId, fieldData] of Object.entries(data)) {
        console.log(`🔍 Processing field ${fieldId}:`, fieldData);
        
        if (fieldData.value && fieldMapping[fieldId]) {
          let fieldValue = fieldData.value;
          const fieldName = fieldMapping[fieldId];
          
          // Обрабатываем поле выбора (подразделение, семейное положение и т.д.)
          if (Array.isArray(fieldValue)) {
            // Берем text для отображения и slug/text для определения подразделения
            fieldValue = fieldValue.map(item => {
              const displayValue = item.text || item.slug || item.key || JSON.stringify(item);
              
              // Для подразделения сохраняем slug И text для поиска ролей
              if (fieldName.includes('Подразделение')) {
                // Пробуем сначала найти по slug, потом по text
                if (item.slug) {
                  department = item.slug.toLowerCase();
                  console.log(`🎯 Found Department from slug: "${department}"`);
                } else if (item.text) {
                  department = item.text.toLowerCase();
                  console.log(`🎯 Found Department from text: "${department}"`);
                }
              }
              
              return displayValue;
            }).join(', ');
          } else {
            // Для обычных полей
            if (fieldName.includes('DiscordID')) {
              discordId = String(fieldValue).replace(/[@<>]/g, '');
              console.log(`🎯 Found Discord ID: ${discordId}`);
            }
          }
          
          formData[fieldName] = String(fieldValue);
        }
      }
    }
    // Формат с массивом полей
    else if (Array.isArray(answersData)) {
      console.log('📝 Detected array format');
      
      for (const field of answersData) {
        if (field && field.id && fieldMapping[field.id]) {
          const fieldName = fieldMapping[field.id];
          let fieldValue = '';
          
          // Обрабатываем разные типы полей
          if (field.choices) {
            // Поле с выбором (select, radio) - используем labels для отображения
            fieldValue = field.choices.labels ? field.choices.labels.join(', ') : 
                        field.choices.other || '';
            
            // Для подразделения сохраняем значение для поиска ролей
            if (fieldName.includes('Подразделение')) {
              department = fieldValue.toLowerCase();
              console.log(`🎯 Found Department: "${department}"`);
            }
          } else if (field.value) {
            // Текстовое поле
            fieldValue = field.value;
            
            // Сохраняем Discord ID
            if (fieldName.includes('DiscordID')) {
              discordId = String(fieldValue).replace(/[@<>]/g, '');
              console.log(`🎯 Found Discord ID: ${discordId}`);
            }
          } else if (field.text) {
            // Текстовое поле (альтернативный формат)
            fieldValue = field.text;
          }
          
          formData[fieldName] = String(fieldValue);
        } else if (field && field.id) {
          console.log(`⚠️ Unknown field ID: ${field.id}`);
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
  console.log('🎯 Department for roles:', department);
  console.log('🆔 Discord ID:', discordId);
  return { formData, discordId, department };
}

// Функция для получения ролей по подразделению
function getDepartmentRoles(formType, department) {
  const config = FORM_CONFIGS[formType];
  
  console.log(`🔍 DEBUG getDepartmentRoles: formType=${formType}, department="${department}"`);
  
  if (formType === 'documents') {
    console.log(`📝 Using default roles for documents`);
    return config.defaultRoleIds || [];
  }
  
  if (formType === 'dismissal' && department && config.departmentRoles) {
    // Приводим department к нижнему регистру для поиска
    const departmentLower = department.toLowerCase().trim();
    console.log(`🔍 Searching for department: "${departmentLower}"`);
    console.log(`🔍 Available department keys:`, Object.keys(config.departmentRoles));
    
    // Маппинг различных вариантов названий на ключи
    const departmentMapping = {
      // FPF варианты
      'fpf': 'fpf',
      'fp force': 'fpf',
      'force protection force': 'fpf',
      'force protection': 'fpf',
      '9008960389129250': 'fpf', // если приходит числовой ID
      
      // SSF варианты
      'ssf': 'ssf', 
      'special security force': 'ssf',
      'special security': 'ssf',
      '1761143395395': 'ssf',
      
      // SOAR варианты
      'soar': 'soar',
      'special operations and response': 'soar',
      'special operations': 'soar',
      '1761143401382': 'soar',
      
      // MP варианты
      'mp': 'mp',
      'military police': 'mp',
      'полиция': 'mp',
      '1761143405371': 'mp',
      
      // MTA варианты
      'mta': 'mta',
      'military training academy': 'mta',
      'training academy': 'mta',
      '1761143410900': 'mta',
      
      // Academy варианты
      'academy': 'academy',
      'академия': 'academy',
      '1761143419535': 'academy'
    };
    
    // Ищем совпадение в маппинге
    for (const [key, deptKey] of Object.entries(departmentMapping)) {
      if (departmentLower === key.toLowerCase() || departmentLower.includes(key.toLowerCase())) {
        console.log(`✅ Department match found: "${key}" -> ${deptKey}`);
        const roles = config.departmentRoles[deptKey];
        console.log(`🎯 Roles for ${deptKey}:`, roles);
        return roles || config.defaultRoleIds;
      }
    }
    
    // Если не нашли в маппинге, пробуем прямые ключи
    for (const [deptKey, roles] of Object.entries(config.departmentRoles)) {
      if (departmentLower === deptKey.toLowerCase() || departmentLower.includes(deptKey.toLowerCase())) {
        console.log(`✅ Direct department match: ${deptKey}`);
        console.log(`🎯 Roles for ${deptKey}:`, roles);
        return roles;
      }
    }
    
    console.log(`❌ No department match found for: "${departmentLower}"`);
  }
  
  console.log(`⚙️ Using default roles:`, config.defaultRoleIds);
  return config.defaultRoleIds || [];
}

// Универсальный обработчик для всех форм
function createFormHandler(formType) {
  return async (req, res) => {
    console.log(`\n📨 ===== НОВЫЙ ЗАПРОС ОТ ФОРМЫ (${formType}) =====`);
    console.log('🔍 Method:', req.method);
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
      
      // Обрабатываем СЛОЖНЫЙ формат Яндекс.Форм (с пустым ключом в params)
      if (req.body && req.body.params && req.body.params[""]) {
        console.log('📝 Detected Yandex Forms format with empty key');
        try {
          const answersData = typeof req.body.params[""] === 'string' 
            ? JSON.parse(req.body.params[""]) 
            : req.body.params[""];
          
          console.log('📊 Parsed answers data:', JSON.stringify(answersData, null, 2));
          
          // Извлекаем данные из правильной структуры
          if (answersData.answer && answersData.answer.data) {
            const extracted = extractFormData(answersData, config.fieldMapping);
            formData = extracted.formData;
            discordId = extracted.discordId;
            department = extracted.department;
          } else {
            console.log('❌ Unexpected answers data structure');
          }
          
        } catch (parseError) {
          console.error('❌ JSON parsing error:', parseError.message);
        }
      }
      // Старый формат (для обратной совместимости)
      else if (req.body && req.body.params && req.body.params.answers) {
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

      // ОТЛАДКА ПОСЛЕ ИЗВЛЕЧЕНИЯ ДАННЫХ
      console.log('🎯 FINAL VALUES:');
      console.log('   - Department:', department);
      console.log('   - Discord ID:', discordId);
      console.log('   - Form Data keys:', Object.keys(formData));

      // Временно: если данные пустые, показываем сырые данные для отладки
      if (Object.keys(formData).length === 0 && req.body && req.body.params && req.body.params[""]) {
        console.log('⚠️ No data extracted, showing raw data for debugging');
        const rawData = typeof req.body.params[""] === 'string' 
          ? JSON.parse(req.body.params[""]) 
          : req.body.params[""];
        
        // Показываем структуру для отладки
        formData = {
          '🔍 DEBUG - Raw Structure': 'Showing data structure for debugging',
          '📊 ID': rawData.id || 'N/A',
          '📋 Survey ID': rawData.survey_id || 'N/A'
        };
        
        // Добавляем поля если они есть
        if (rawData.answer && rawData.answer.data) {
          for (const [fieldId, fieldData] of Object.entries(rawData.answer.data)) {
            if (fieldData.value) {
              const fieldName = config.fieldMapping[fieldId] || fieldId;
              let fieldValue = fieldData.value;
              
              if (Array.isArray(fieldValue)) {
                fieldValue = fieldValue.map(item => item.text || item.slug || item.key).join(', ');
              }
              
              formData[fieldName] = String(fieldValue);
            }
          }
        }
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

      console.log(`👥 Final role mentions: ${roleMentions}`);

      const discordPayload = {
        username: config.username,
        content: roleMentions || ' ',
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
app.post('/webhook/gentoken', createFormHandler('gentoken'));
app.post('/webhook/voennik', createFormHandler('voennik'));
app.post('/webhook/perevod_1', createFormHandler('perevod_1'));
app.post('/webhook', createFormHandler('documents')); // для обратной совместимости

// Страница проверки работы
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK 👍', 
    service: 'Разработчик @secretkznch',
    endpoints: {
      documents: '/webhook/documents',
      dismissal: '/webhook/dismissal',
      gentoken: '/webhook/gentoken',
      voennik: '/webhook/voennik',
      perevod_1: '/webhook/perevod_1',
      legacy: '/webhook'
    },
    environment: {
      hasDocumentsWebhook: !!process.env.DISCORD_WEBHOOK_DOCUMENTS,
      hasDismissalWebhook: !!process.env.DISCORD_WEBHOOK_DISMISSAL,
      hasGentokenWebhook: !!process.env.DISCORD_WEBHOOK_GENTOKEN,
      hasVoennikWebhook: !!process.env.DISCORD_WEBHOOK_VOENNIK,
      hasPerevod_1Webhook: !!process.env.DISCORD_WEBHOOK_PEREVOD_1,
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
  console.log(`🔗 Webhook для генеральских жетонов: http://localhost:${PORT}/webhook/gentoken`);
  console.log(`🔗 Webhook военных билетов: http://localhost:${PORT}/webhook/voennik`);
  console.log(`🔗 Webhook разрешения на перевод: http://localhost:${PORT}/webhook/perevod_1`);
  console.log(`🔍 Проверка конфигурации:`);
  console.log(`   - DISCORD_WEBHOOK_DOCUMENTS: ${process.env.DISCORD_WEBHOOK_DOCUMENTS ? '✅ Настроен' : '❌ Отсутствует'}`);
  console.log(`   - DISCORD_WEBHOOK_DISMISSAL: ${process.env.DISCORD_WEBHOOK_DISMISSAL ? '✅ Настроен' : '❌ Отсутствует'}`);
  console.log(`   - DISCORD_WEBHOOK_GENTOKEN: ${process.env.DISCORD_WEBHOOK_GENTOKEN ? '✅ Настроен' : '❌ Отсутствует'}`);
  console.log(`   - DISCORD_WEBHOOK_VOENNIK: ${process.env.DISCORD_WEBHOOK_VOENNIK ? '✅ Настроен' : '❌ Отсутствует'}`);
  console.log(`   - DISCORD_WEBHOOK_PEREVOD_1: ${process.env.DISCORD_WEBHOOK_PEREVOD_1 ? '✅ Настроен' : '❌ Отсутствует'}`);
});
