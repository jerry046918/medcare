import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import {
  Button,
  Select,
  DatePicker,
  Collapse,
  Input,
  Result,
  Spin,
  message,
  Card,
  Space
} from 'antd';
import { CameraOutlined, ReloadOutlined, PlusOutlined, EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { reduceStage } from '../../utils/quickUploadMachine';
import { createReport } from '../../store/slices/reportSlice';
import { fetchFamilyMembers } from '../../store/slices/familyMemberSlice';
import { fetchIndicators } from '../../store/slices/indicatorSlice';
import IndicatorEditTable, { newIndicatorRow, applyIndicatorChange } from '../../components/common/IndicatorEditTable';
import ocrAPI from '../../api/ocrAPI';

// 与桌面端 OCR 行结构一致（ReportUpload.populateIndicatorsFromOCR 同款归一化）
const toIndicatorRows = (parsedIndicators) => (parsedIndicators || []).map((item, i) => ({
  id: Date.now() + i,
  indicatorId: item.indicatorId || null,
  value: item.value || '',
  referenceRange: item.referenceRange || '',
  isNormal: item.isNormal !== undefined ? item.isNormal : null,
  abnormalType: item.abnormalType || 'normal',
  notes: item.notes || '',
  ocrMatched: !!item.indicatorId,
  ocrName: item.name || ''
}));

// 提交过滤：与桌面端 handleSubmit 的过滤条件保持一致
const filterRows = (rows) => rows.filter(item =>
  item.indicatorId !== null &&
  item.indicatorId !== undefined &&
  item.value !== undefined &&
  item.value !== '' &&
  item.value !== null
);

export default function QuickUpload() {
  const [stage, setStage] = useState('capture');
  const [file, setFile] = useState(null);
  const [ocrIndicators, setOcrIndicators] = useState([]);
  const [memberId, setMemberId] = useState(null);
  const [reportDate, setReportDate] = useState(dayjs());
  const [hospital, setHospital] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // 多选：第一张立即处理，其余入队
  const [queue, setQueue] = useState([]);
  const inputRef = useRef(null);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { selfMember } = useSelector((s) => s.auth);
  const { list: members } = useSelector((s) => s.familyMembers);
  const { list: indicators } = useSelector((s) => s.indicators);

  useEffect(() => {
    dispatch(fetchFamilyMembers());
    dispatch(fetchIndicators());
  }, [dispatch]);

  // 成员默认本人（auth v2 selfMember）
  useEffect(() => {
    if (selfMember?.id) setMemberId(selfMember.id);
  }, [selfMember]);

  // 触发识别：统一走 FILE_PICKED 事件（capture→recognizing；队列续张时已在 recognizing 则原态保持）
  const recognize = (f) => {
    setFile(f);
    setStage((s) => reduceStage(s, 'FILE_PICKED'));
    ocrAPI.recognizeAndParse(f)
      .then((res) => {
        if (res.success && res.data) {
          setOcrIndicators(toIndicatorRows(res.data.indicators));
          setStage((s) => reduceStage(s, 'OCR_OK'));
        } else {
          throw new Error(res.message || 'OCR 识别失败');
        }
      })
      .catch(() => {
        setOcrIndicators([]);
        setStage((s) => reduceStage(s, 'OCR_FAIL'));
      });
  };

  const pick = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = ''; // 允许连选同名文件
    const valid = files.filter((f) =>
      (f.type.startsWith('image/') || f.type === 'application/pdf') && f.size <= 10 * 1024 * 1024);
    if (valid.length < files.length) message.warning('已跳过不支持的文件（仅图片/PDF，≤10MB）');
    if (valid.length === 0) return;
    setQueue(valid.slice(1));
    recognize(valid[0]);
  };

  // 队列续张：done → recognizing，识别通过后仍回到 review（成员/日期沿用上次选择）
  const nextFile = () => {
    const [next, ...rest] = queue;
    if (!next) return;
    setQueue(rest);
    setOcrIndicators([]);
    setHospital('');
    setNotes('');
    setStage((s) => reduceStage(s, 'NEXT_FILE'));
    recognize(next);
  };

  const submit = async () => {
    if (!memberId) {
      message.warning('请选择成员');
      return;
    }
    setSubmitting(true);
    try {
      const filtered = filterRows(ocrIndicators);
      if (ocrIndicators.length > 0 && filtered.length === 0) {
        message.warning('指标均未选择或未填写数值，将不包含指标数据');
      }
      // 与 v1 ReportUpload 相同的入参形状；FormData 由 reportAPI.create 构建，
      // 附件字段名为 file（与后端 multer single('file') 一致）
      await dispatch(createReport({
        familyMemberId: memberId,
        reportDate: reportDate.format('YYYY-MM-DD'),
        hospitalName: hospital || undefined,
        notes: notes || undefined,
        indicatorData: filtered,
        reportFile: file
      })).unwrap();
      setStage((s) => reduceStage(s, 'SUBMIT_OK'));
    } catch (err) {
      // createReport thunk rejectWithValue 的是字符串（后端 message）
      message.error(typeof err === 'string' ? err : (err?.message || '保存失败'));
      setStage((s) => reduceStage(s, 'SUBMIT_FAIL'));
    } finally {
      setSubmitting(false);
    }
  };

  // 再拍一张：回到 capture 并清空本轮数据（队列一并清空，避免误续旧照片）
  const reset = () => {
    setFile(null);
    setOcrIndicators([]);
    setHospital('');
    setNotes('');
    setQueue([]);
    setStage((s) => reduceStage(s, 'RESET'));
  };

  // 重试：回 capture（机器 RETRY 事件）后立即对保留的照片重新识别
  const retry = () => {
    setStage((s) => reduceStage(s, 'RETRY'));
    if (file) {
      recognize(file);
    }
  };

  // 跳过识别：清空识别结果直接进确认，照片保留随表单提交
  const skip = () => {
    setOcrIndicators([]);
    setStage((s) => reduceStage(s, 'SKIP'));
  };

  const handleAddIndicator = () => {
    setOcrIndicators([...ocrIndicators, newIndicatorRow()]);
  };

  // 下拉「新建指标」：创建成功后刷新指标库并回填该行（异常状态按现库重算，与桌面端一致）
  const handleCreateIndicator = async (rowId, info) => {
    try {
      const res = await ocrAPI.createIndicator({
        name: info.name,
        unit: info.unit || '',
        type: info.type || '血液',
        valueType: 'numeric',
        isDefault: false
      });
      if (res.success && res.data) {
        dispatch(fetchIndicators());
        setOcrIndicators(prev => applyIndicatorChange(prev, indicators, rowId, 'indicatorId', res.data.id));
        message.success(`指标 "${info.name}" 创建成功`);
      }
    } catch (error) {
      message.error(`创建指标失败: ${error.message}`);
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      {/* 隐藏的相机/相册输入：capture 在移动端唤起相机，multiple 支持多页报告连拍 */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        capture="environment"
        style={{ display: 'none' }}
        onChange={pick}
      />

      <div style={{ textAlign: 'right', marginBottom: 8 }}>
        <Button type="link" size="small" icon={<EditOutlined />} onClick={() => navigate('/reports/upload')}>
          完整模式
        </Button>
      </div>

      {stage === 'capture' && (
        <Card>
          <Button
            type="primary"
            size="large"
            block
            icon={<CameraOutlined />}
            style={{ height: 96, fontSize: 18, borderRadius: 16 }}
            onClick={() => inputRef.current.click()}
          >
            拍照或选择报告
          </Button>
          <p style={{ color: '#94a3b8', textAlign: 'center', marginTop: 12 }}>
            支持检验报告拍照，自动识别指标
          </p>
        </Card>
      )}

      {stage === 'recognizing' && (
        <Card style={{ textAlign: 'center', padding: 32 }}>
          <Spin size="large" />
          <p style={{ marginTop: 16 }}>正在识别报告内容…</p>
        </Card>
      )}

      {stage === 'error' && (
        <Card style={{ textAlign: 'center' }}>
          <p>识别失败，可重试或跳过识别直接保存（照片已保留）</p>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={retry}>重试</Button>
            <Button type="primary" onClick={skip}>跳过识别，手动填写</Button>
          </Space>
        </Card>
      )}

      {stage === 'review' && (
        <Card title="确认报告信息">
          <div style={{ marginBottom: 12 }}>
            <div style={{ marginBottom: 6, color: '#64748b' }}>成员（默认本人）</div>
            <Select
              value={memberId}
              onChange={setMemberId}
              style={{ width: '100%' }}
              size="large"
              options={members.map((m) => ({ value: m.id, label: `${m.name}（${m.relationship || m.role || '成员'}）` }))}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ marginBottom: 6, color: '#64748b' }}>报告日期</div>
            <DatePicker
              value={reportDate}
              onChange={(d) => d && setReportDate(d)}
              style={{ width: '100%' }}
              size="large"
            />
          </div>
          <Collapse
            ghost
            items={[{
              key: 'more',
              label: '医院 / 备注（可选）',
              children: (
                <>
                  <Input
                    placeholder="医院名称"
                    value={hospital}
                    onChange={(e) => setHospital(e.target.value)}
                    style={{ marginBottom: 8 }}
                  />
                  <Input.TextArea
                    placeholder="备注"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                  />
                </>
              )
            }]}
            style={{ marginBottom: 12 }}
          />
          {file && (
            <p style={{ color: '#94a3b8', fontSize: 12, margin: '0 0 8px' }}>已拍摄：{file.name}</p>
          )}
          <IndicatorEditTable
            indicators={indicators}
            value={ocrIndicators}
            onChange={setOcrIndicators}
            onCreateIndicator={handleCreateIndicator}
          />
          <Button type="dashed" block icon={<PlusOutlined />} onClick={handleAddIndicator}
                  style={{ marginTop: 8 }}>
            添加指标
          </Button>
          <Button
            type="primary"
            size="large"
            block
            loading={submitting}
            onClick={submit}
            style={{ marginTop: 16, height: 48, borderRadius: 12 }}
          >
            保存报告
          </Button>
        </Card>
      )}

      {stage === 'done' && (
        <Result
          status="success"
          title="报告已保存"
          extra={
            <Space direction="vertical" style={{ width: '100%' }}>
              {queue.length > 0 && (
                <Button type="primary" size="large" block icon={<CameraOutlined />} onClick={nextFile}>
                  下一张（还剩 {queue.length} 张）
                </Button>
              )}
              <Button
                type={queue.length ? 'default' : 'primary'}
                size="large"
                block
                icon={<CameraOutlined />}
                onClick={reset}
              >
                再拍一张
              </Button>
              <Button size="large" block onClick={() => navigate('/reports')}>完成</Button>
            </Space>
          }
        />
      )}
    </div>
  );
}
