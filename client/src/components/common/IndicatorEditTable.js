import React from 'react';
import {
  Table,
  Input,
  Select,
  Button,
  Tag,
  Popconfirm,
  Space,
  Divider,
  Modal
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import ocrAPI from '../../api/ocrAPI';

const { Option } = Select;

/**
 * 新建空指标行（行结构，QuickUpload / ReportUpload / ReportEdit 共用）
 */
export const newIndicatorRow = () => ({
  id: Date.now(),
  indicatorId: null,
  value: '',
  referenceRange: '',
  isNormal: true,
  notes: ''
});

/**
 * 自动判断异常状态（定性按 normalValue、数值按 normalMin/normalMax）
 */
export const checkAbnormalStatus = (indicators, indicatorId, value) => {
  if (!indicatorId || !value || !indicators || indicators.length === 0) {
    return { isNormal: null, abnormalType: null };
  }

  const indicator = indicators.find(ind => ind.id === indicatorId);
  if (!indicator) {
    return { isNormal: null, abnormalType: null };
  }

  // 定性指标判断
  if (indicator.valueType === 'qualitative') {
    if (indicator.normalValue) {
      const isNormal = value === indicator.normalValue;
      return {
        isNormal,
        abnormalType: isNormal ? 'normal' : 'abnormal'
      };
    }
    return { isNormal: null, abnormalType: null };
  }

  // 数值型指标判断
  if (indicator.valueType === 'numeric' && indicator.normalMin !== null && indicator.normalMax !== null) {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      return { isNormal: null, abnormalType: null };
    }

    if (numValue >= indicator.normalMin && numValue <= indicator.normalMax) {
      return { isNormal: true, abnormalType: 'normal' };
    } else if (numValue > indicator.normalMax) {
      return { isNormal: false, abnormalType: 'high' };
    } else {
      return { isNormal: false, abnormalType: 'low' };
    }
  }

  return { isNormal: null, abnormalType: null };
};

/**
 * 行编辑纯函数：设置字段，并在 检测值/指标ID 变化时重算异常状态。
 * 返回新数组（受控用法：onChange(applyIndicatorChange(rows, ...))）。
 */
export const applyIndicatorChange = (rows, indicators, id, field, value) =>
  (rows || []).map(item => {
    if (item.id === id) {
      const updatedItem = { ...item, [field]: value };

      // 当检测值或指标ID变化时，自动判断异常状态
      if (field === 'value' || field === 'indicatorId') {
        const indicatorId = field === 'indicatorId' ? value : item.indicatorId;
        const testValue = field === 'value' ? value : item.value;

        Object.assign(updatedItem, checkAbnormalStatus(indicators, indicatorId, testValue));
      }

      return updatedItem;
    }
    return item;
  });

/**
 * 指标编辑表格（受控组件）
 *
 * Props:
 * - indicators        指标库列表（state.indicators.list）
 * - value             指标行数组（结构见 newIndicatorRow，可含 ocrMatched/ocrName/ocrUnit）
 * - onChange(nextRows) 行数组更新回调（受控）
 * - onCreateIndicator(rowId, info) 下拉「新建指标」回调（页面级，走 ocrAPI.createIndicator）
 * - onAddRow          可选；提供时空状态展示「添加第一个指标」按钮（桌面端行为）
 * - style             透传给 Table
 */
const IndicatorEditTable = ({
  indicators,
  value: rows,
  onChange,
  onCreateIndicator,
  onAddRow,
  style
}) => {
  const handleChange = (id, field, val) => {
    onChange(applyIndicatorChange(rows, indicators, id, field, val));
  };

  const handleRemove = (id) => {
    onChange(rows.filter(item => item.id !== id));
  };

  const indicatorColumns = [
    {
      title: '指标名称',
      dataIndex: 'indicatorId',
      key: 'indicatorId',
      width: 240,
      render: (value, record) => (
        <Space direction="vertical" size={0} style={{ width: '100%' }}>
          <Select
            placeholder="选择指标"
            style={{ width: '100%' }}
            value={value || undefined}
            status={record.ocrMatched === false && !value ? 'warning' : undefined}
            onChange={(val) => {
              let next = applyIndicatorChange(rows, indicators, record.id, 'indicatorId', val);
              const indicator = indicators.find(ind => ind.id === val);
              if (indicator) {
                next = applyIndicatorChange(next, indicators, record.id, 'referenceRange', indicator.referenceRange || '');
              }
              next = next.map(item =>
                item.id === record.id ? { ...item, ocrMatched: true } : item
              );
              if (record.ocrName) {
                ocrAPI.confirmMatch(val, record.ocrName).catch(() => {});
              }
              onChange(next);
            }}
            showSearch
            optionFilterProp="label"
            filterOption={(input, option) =>
              option?.label?.toLowerCase().indexOf(input.toLowerCase()) >= 0
            }
            dropdownRender={(menu) => (
              <>
                {menu}
                <Divider style={{ margin: '4px 0' }} />
                <Button
                  type="link"
                  icon={<PlusOutlined />}
                  style={{ padding: '4px 8px', width: '100%', textAlign: 'left' }}
                  onClick={() => {
                    Modal.confirm({
                      title: '新建指标',
                      content: `将创建指标 "${record.ocrName || '未命名'}"`,
                      onOk: () => onCreateIndicator(record.id, {
                        name: record.ocrName || '',
                        unit: record.ocrUnit || '',
                      })
                    });
                  }}
                >
                  新建指标...
                </Button>
              </>
            )}
            options={indicators.map(indicator => ({
              value: indicator.id,
              label: `${indicator.name} (${indicator.unit})`
            }))}
          />
          {record.ocrMatched === false && !value && (
            <Tag color="orange" style={{ fontSize: 11 }}>待确认: {record.ocrName}</Tag>
          )}
        </Space>
      )
    },
    {
      title: '检测值',
      dataIndex: 'value',
      key: 'value',
      width: 120,
      render: (value, record) => {
        const indicator = indicators.find(ind => ind.id === record.indicatorId);
        if (indicator?.valueType === 'qualitative') {
          return (
            <Select placeholder="选择结果" value={value}
              onChange={(val) => handleChange(record.id, 'value', val)}
              style={{ width: '100%' }}>
              <Option value="positive">阳性</Option>
              <Option value="negative">阴性</Option>
            </Select>
          );
        }
        return (
          <Input placeholder="输入数值" value={value}
            onChange={(e) => handleChange(record.id, 'value', e.target.value)} />
        );
      }
    },
    {
      title: '参考范围',
      dataIndex: 'referenceRange',
      key: 'referenceRange',
      width: 150,
      render: (value, record) => (
        <Input placeholder="如: 3.9-6.1" value={value}
          onChange={(e) => handleChange(record.id, 'referenceRange', e.target.value)} />
      )
    },
    {
      title: '状态',
      key: 'status',
      width: 120,
      render: (_, record) => {
        const { isNormal, abnormalType } = record;
        if (isNormal === true || abnormalType === 'normal') return <Tag color="green">正常</Tag>;
        if (abnormalType === 'high') return <Tag color="red">偏高</Tag>;
        if (abnormalType === 'low') return <Tag color="orange">偏低</Tag>;
        if (abnormalType === 'abnormal') return <Tag color="red">异常</Tag>;
        if (isNormal === false) return <Tag color="red">异常</Tag>;
        return <Tag color="default">未判断</Tag>;
      }
    },
    {
      title: '备注',
      dataIndex: 'notes',
      key: 'notes',
      render: (value, record) => (
        <Input placeholder="备注信息" value={value}
          onChange={(e) => handleChange(record.id, 'notes', e.target.value)} />
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_, record) => (
        <Popconfirm title="确定删除这个指标吗？" onConfirm={() => handleRemove(record.id)}
          okText="确定" cancelText="取消">
          <Button type="text" danger icon={<DeleteOutlined />} size="small" />
        </Popconfirm>
      )
    }
  ];

  return (
    <Table
      columns={indicatorColumns}
      dataSource={rows}
      rowKey="id"
      pagination={false}
      size="small"
      style={style}
      locale={{
        emptyText: onAddRow ? (
          <div style={{ padding: '20px', textAlign: 'center' }}>
            <p>暂无指标数据，请上传报告自动识别或手动添加</p>
            <Button type="dashed" icon={<PlusOutlined />} onClick={onAddRow}>
              添加第一个指标
            </Button>
          </div>
        ) : (
          <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
            暂无指标数据，可点击下方「添加指标」手动录入
          </div>
        )
      }}
    />
  );
};

export default IndicatorEditTable;
