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
    roleIds: [
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
    // ⚠️ ЗАМЕНИ НА РЕАЛЬНЫЙ ID ПОЛЯ "ПОДРАЗДЕЛЕНИЕ"
    departmentFieldId: 'answer_choices_9008960389129240',
    // Динамические роли для подразделений
    departmentRoles: {
      'fpf': [process.env.DISCORD_ROLE_FPF_1, process.env.DISCORD_ROLE_FPF_2],
      'ssf': [process.env.DISCORD_ROLE_SSF_1, process.env.DISCORD_ROLE_SSF_2],
      'soar': [process.env.DISCORD_ROLE_SOAR_1, process.env.DISCORD_ROLE_SOAR_2],
      'mp': [process.env.DISCORD_ROLE_MP_1, process.env.DISCORD_ROLE_MP_2],
      'mta': [process.env.DISCORD_ROLE_MTA_1, process.env.DISCORD_ROLE_MTA_2],
      'academy': [process.env.DISCORD_ROLE_ACADEMY_1, process.env.DISCORD_ROLE_ACADEMY_2]
    },
    // Роли по умолчанию
    defaultRoleIds: [process.env.DISCORD_ROLE_DISMISSAL_1, process.env.DISCORD_ROLE_DISMISSAL_2],
    fieldMapping: {
      // ⚠️ ЗАМЕНИ НА РЕАЛЬНЫЕ ID ПОЛЕЙ ФОРМЫ УВОЛЬНЕНИЯ
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

// Функция для извлечения значений из сложной структуры Яндекс.Форм
function extractFormData(answersData, fieldMapping) {
  const formData = {};
  let discordId = null;
  let department = null;
  
  if (answersData.answer && answersData.answer.data) {
    const data = answersData.answer.data;
    
    // Обрабатываем каждое поле
    for (const [fieldId, fieldData] of Object.entries(data)) {
      if (fieldData.value) {
        let fieldValue = fieldData.value;
        
        // Обрабатываем выбор из списка
        if (Array.isArray(fieldValue)) {
          fieldValue = fieldValue.map(item => item.text || item.slug || item.key).join(', ');
          // Сохраняем slug для определения подразделения
          if (fieldData.value[0] && fieldData.value[0].slug) {
            department = fieldData.value[0].slug;
          }
        }
        
        // Сохраняем Discord ID отдельно для упоминания
        if (fieldId in fieldMapping && fieldMapping[fieldId].includes('DiscordID')) {
          discordId = String(fieldValue).replace('@', '');
        }
        
        // Берем человекочитаемое название или используем ID
        const fieldName = fieldMapping[fieldId] || fieldId;
        formData[fieldName] = String(fieldValue);
      }
    }
  }
  
  return { formData, discordId, department };
}

// Функция для получения ролей по подразделению
function getDepartmentRoles(formType, department) {
  const config = FORM_CONFIGS[formType];
  
  if (!config.departmentRoles || !department) {
    return config.defaultRoleIds || config.roleIds || [];
  }
  
  // Ищем роли для выбранного подразделения
  for (const [dept, roles] of Object.entries(config.departmentRoles)) {
    if (department.toLowerCase().includes(dept.toLowerCase())) {
      return roles;
    }
  }
  
  // Возвращаем роли по умолчанию, если подразделение не распознано
  return config.defaultRoleIds || config.roleIds || [];
}

// Универсальный обработчик для всех форм
function createFormHandler(formType) {
  return async (req, res) => {
    console.log(`📨 Получен запрос от Яндекс.Формы (${formType})`);
    
    const config = FORM_CONFIGS[formType];
    if (!config) {
      console.error(`❌ Неизвестный тип формы: ${formType}`);
      return res.status(400).json({ error: 'Unknown form type' });
    }

    if (!config.webhookUrl) {
      console.error(`❌ Ошибка: Webhook URL для формы ${formType} не настроен`);
      return res.status(500).json({ error: 'Server configuration error' });
    }
    
    try {
      let formData = {};
      let discordId = null;
      let department = null;
      
      // Обрабатываем JSON-RPC формат от Яндекс.Форм
      if (req.body && req.body.params && req.body.params.answers) {
        try {
          // Парсим JSON из answers
          const answersData = JSON.parse(req.body.params.answers);
          console.log('📊 Ответы формы:', JSON.stringify(answersData, null, 2));
          
          // Извлекаем данные
          const extracted = extractFormData(answersData, config.fieldMapping);
          formData = extracted.formData;
          discordId = extracted.discordId;
          department = extracted.department;
          console.log('📋 Обработанные данные:', formData);
          console.log('🆔 Discord ID для упоминания:', discordId);
          console.log('🏢 Подразделение:', department);
          
        } catch (parseError) {
          console.error('❌ Ошибка парсинга JSON:', parseError.message);
          formData = { '❌ Ошибка': 'Не удалось обработать данные формы' };
        }
      } else {
        // Обычный JSON запрос
        formData = req.body;
        console.log('📊 Данные формы:', formData);
      }

      const embed = {
        title: config.title,
        color: formType === 'dismissal' ? 0xFF0000 : 0x00FF00, // Красный для увольнения
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

      // Если нет данных
      if (embed.fields.length === 0) {
        embed.fields.push({
          name: '⚠️ Внимание',
          value: 'Данные формы не распознаны. Проверьте настройки.',
          inline: false
        });
      }

      // Определяем какие роли упоминать
      let roleIds = [];
      
      if (formType === 'dismissal' && department) {
        // Для формы увольнения используем динамические роли по подразделению
        roleIds = getDepartmentRoles(formType, department);
        console.log(`🎯 Используем роли для подразделения "${department}":`, roleIds);
      } else {
        // Для других форм используем стандартные роли
        roleIds = config.roleIds || [];
        console.log(`⚙️ Используем стандартные роли:`, roleIds);
      }

      // Создаем упоминания ролей
      const roleMentions = roleIds.filter(roleId => roleId).map(roleId => `<@&${roleId}>`).join(' ');

      const discordPayload = {
        username: config.username,
        content: roleMentions || ' ', // Упоминание ролей в начале сообщения
        embeds: [embed]
      };

      console.log(`🔄 Отправляем в Discord (${formType})...`);
      console.log(`👥 Упоминаем роли: ${roleMentions}`);
      console.log(`🌐 Webhook: ${config.webhookUrl}`);
      
      const discordResponse = await axios.post(config.webhookUrl, discordPayload, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log(`✅ Успешно отправлено в Discord (${formType})!`);
      
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
      console.error(`❌ Ошибка (${formType}):`, error.message);
      
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
  };
}

// Регистрируем разные эндпоинты для разных форм
app.post('/webhook/documents', createFormHandler('documents'));
app.post('/webhook/dismissal', createFormHandler('dismissal'));
app.post('/webhook', createFormHandler('documents')); // для обратной совместимости

// Страница проверки работы
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK 👍', 
    service: 'Яндекс.Формы → Discord (Multi-form)',
    availableEndpoints: [
      '/webhook/documents - для документов',
      '/webhook/dismissal - для увольнений (с динамическими ролями по подразделениям)',
      '/webhook - для обратной совместимости (документы)'
    ]
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
  console.log(`🔗 Webhook для документов: http://localhost:${PORT}/webhook/documents`);
  console.log(`🔗 Webhook для увольнений: http://localhost:${PORT}/webhook/dismissal`);
});
