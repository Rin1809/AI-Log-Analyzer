import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useOutletContext, useParams, useNavigate } from 'react-router-dom';
import {
  Box, Heading, VStack, Spinner, Alert, AlertIcon, useToast, useColorModeValue, Button,
  FormControl, FormLabel, Input, Switch, Grid, GridItem, Text, Select, Radio, RadioGroup, Stack,
  IconButton, Tag, TagLabel, TagCloseButton, Wrap, useDisclosure, Flex,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalFooter, ModalBody, ModalCloseButton, Center, HStack,
  Checkbox, InputGroup, InputLeftElement, CloseButton, Tooltip
} from '@chakra-ui/react';
import { ArrowBackIcon, AddIcon, SearchIcon, DeleteIcon, AttachmentIcon } from '@chakra-ui/icons';

const FormCard = ({ title, children }) => {
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  return (
    <Box p={6} borderWidth="1px" borderColor={borderColor} borderRadius="lg" bg={cardBg}>
      <Heading size="md" fontWeight="normal" mb={5}>{title}</Heading>
      <VStack spacing={4} align="stretch">{children}</VStack>
    </Box>
  );
};

const HostFormPage = () => {
  const { isTestMode } = useOutletContext();
  const { hostId } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(hostId);
  const toast = useToast();

  // --- Define Color Styles Hooks ---
  const hoverBg = useColorModeValue('gray.50', 'gray.700');
  
  // Save button styles
  const saveButtonBg = useColorModeValue('gray.800', 'white');
  const saveButtonColor = useColorModeValue('white', 'gray.800');
  const saveButtonHoverBg = useColorModeValue('black', 'gray.200');

  // Button Styles for Context/Diagram Actions (Neutral Gray -> Danger Red)
  const btnGrayBg = useColorModeValue('gray.200', 'gray.600');
  const btnGrayColor = useColorModeValue('gray.600', 'gray.200');
  const btnGrayHoverBg = useColorModeValue('gray.300', 'gray.500');
  
  const btnDangerHoverBg = useColorModeValue('red.100', 'red.900');
  const btnDangerHoverColor = useColorModeValue('red.600', 'red.200');

  const btnAddBg = useColorModeValue('gray.100', 'gray.700');
  const btnAddHoverBg = useColorModeValue('blue.50', 'blue.900');
  const btnAddHoverColor = useColorModeValue('blue.600', 'blue.200');


  const [formData, setFormData] = useState({
    syshostname: '', logfile: '/var/log/filter.log',
    run_interval_seconds: 3600, hourstoanalyze: 24, timezone: 'Asia/Ho_Chi_Minh',
    recipientemails: '', geminiapikey: '', gemini_model: '',
    summary_enabled: false, reports_per_summary: 10, summary_recipient_emails: '', summary_gemini_model: '',
    final_summary_enabled: false, summaries_per_final_report: 4, final_summary_recipient_emails: '', final_summary_model: '',
    networkdiagram: '', smtp_profile: '', 
    context_files: []
  });

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [geminiModels, setGeminiModels] = useState({});
  const [availableContextFiles, setAvailableContextFiles] = useState([]);
  const [smtpProfiles, setSmtpProfiles] = useState([]);
  
  // States for UI control
  const [runIntervalType, setRunIntervalType] = useState('default');
  const [hoursType, setHoursType] = useState('default');
  const [emailInput, setEmailInput] = useState('');
  const [currentEmailField, setCurrentEmailField] = useState(null);
  
  // States for Context Files UI
  const [contextSearchTerm, setContextSearchTerm] = useState('');
  const [filesToDelete, setFilesToDelete] = useState([]); // For bulk delete

  const { isOpen: isEmailModalOpen, onOpen: onEmailModalOpen, onClose: onEmailModalClose } = useDisclosure();
  const { isOpen: isDeleteFileModalOpen, onOpen: onDeleteFileModalOpen, onClose: onDeleteFileModalClose } = useDisclosure();
  
  // Refs for file inputs
  const diagramInputRef = useRef(null);
  const contextInputRef = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      const [modelsRes, contextFilesRes, settingsRes] = await Promise.all([
        axios.get('/api/gemini-models'),
        axios.get('/api/context-files', { params: { test_mode: isTestMode }}),
        axios.get('/api/system-settings', { params: { test_mode: isTestMode }})
      ]);
      
      setGeminiModels(modelsRes.data);
      setAvailableContextFiles(contextFilesRes.data.map(f => `Bonus_context/${f}`));

      const profiles = settingsRes.data.smtp_profiles || {};
      setSmtpProfiles(Object.keys(profiles));

      if (isEditing) {
        const hostRes = await axios.get(`/api/hosts/${hostId}`, { params: { test_mode: isTestMode } });
        setFormData(prev => ({ ...prev, ...hostRes.data }));
        if (hostRes.data.run_interval_seconds !== 3600) setRunIntervalType('custom');
        if (hostRes.data.hourstoanalyze !== 24) setHoursType('custom');
      } else {
         const modelKeys = Object.keys(modelsRes.data);
         if (modelKeys.length > 0) {
            const defaultModel = modelsRes.data[modelKeys[0]];
            setFormData(prev => ({
                ...prev,
                gemini_model: defaultModel,
                summary_gemini_model: defaultModel,
                final_summary_model: defaultModel
            }));
         }
      }
    } catch (err) {
      setError(`Failed to load data. ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [hostId, isEditing, isTestMode]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' || type === 'radio' ? checked : value }));
  };

  const handleNetworkDiagramUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const uploadForm = new FormData();
      uploadForm.append('file', file);
      try {
          const res = await axios.post('/api/upload/context', uploadForm, { params: { test_mode: isTestMode } });
          setFormData(prev => ({ ...prev, networkdiagram: res.data.path }));
          toast({ title: "Success", description: "Network diagram uploaded.", status: 'success' });
      } catch (err) {
          toast({ title: "Upload Failed", description: err.response?.data?.detail || err.message, status: 'error' });
      }
  };
  
  const handleContextFileUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const uploadForm = new FormData();
      uploadForm.append('file', file);
      try {
          const res = await axios.post('/api/upload/context', uploadForm, { params: { test_mode: isTestMode } });
          const newPath = `Bonus_context/${res.data.filename}`;
          
          setAvailableContextFiles(prev => [...prev, newPath]);
          // Auto-select uploaded file
          setFormData(prev => ({ ...prev, context_files: [...prev.context_files, newPath] }));
          
          toast({ title: "Success", description: "Context file uploaded.", status: 'success' });
      } catch (err) {
          toast({ title: "Upload Failed", description: err.response?.data?.detail || err.message, status: 'error' });
      }
  };
  
  // Logic for Bulk Delete Button
  const handleBulkDeleteClick = () => {
      const files = formData.context_files.filter(f => availableContextFiles.includes(f));
      if (files.length === 0) return;
      setFilesToDelete(files);
      onDeleteFileModalOpen();
  }
  
  const confirmDeleteFiles = async () => {
      if (filesToDelete.length === 0) return;
      
      let successCount = 0;
      let failCount = 0;

      for (const file of filesToDelete) {
          try {
              const filename = file.split('/').pop();
              await axios.delete(`/api/context-files/${filename}`, { params: { test_mode: isTestMode } });
              successCount++;
          } catch (err) {
              console.error(`Failed to delete ${file}`, err);
              failCount++;
          }
      }
      
      // Refresh local state
      const deletedFilesSet = new Set(filesToDelete);
      setAvailableContextFiles(prev => prev.filter(f => !deletedFilesSet.has(f)));
      setFormData(prev => ({
          ...prev,
          context_files: prev.context_files.filter(f => !deletedFilesSet.has(f))
      }));
      
      toast({ 
          title: "Bulk Delete Complete", 
          description: `Deleted ${successCount} files. ${failCount > 0 ? `Failed to delete ${failCount} files.` : ''}`, 
          status: failCount === 0 ? "success" : "warning" 
      });

      onDeleteFileModalClose();
      setFilesToDelete([]);
  };

  const handleContextFileToggle = (filePath) => {
    setFormData(prev => {
        const newContextFiles = prev.context_files.includes(filePath)
            ? prev.context_files.filter(f => f !== filePath)
            : [...prev.context_files, filePath];
        return { ...prev, context_files: newContextFiles };
    });
  };

  const openEmailModal = (field) => {
    setCurrentEmailField(field);
    onEmailModalOpen();
  };

  const handleAddEmail = () => {
    if (emailInput && currentEmailField) {
      const currentEmails = formData[currentEmailField] ? formData[currentEmailField].split(',') : [];
      const newEmails = [...currentEmails, emailInput.trim()].filter(Boolean); 
      setFormData(prev => ({ ...prev, [currentEmailField]: newEmails.join(',') }));
      setEmailInput('');
    }
  };

  const handleRemoveEmail = (emailToRemove) => {
    if (currentEmailField) {
      const currentEmails = formData[currentEmailField].split(',');
      const newEmails = currentEmails.filter(e => e !== emailToRemove);
      setFormData(prev => ({ ...prev, [currentEmailField]: newEmails.join(',') }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.syshostname) {
        toast({ title: "Error", description: "Hostname is required.", status: "error", duration: 3000, isClosable: true });
        return;
    }
    setIsSaving(true);
    try {
        const payload = { ...formData };
        if (isEditing) {
            await axios.put(`/api/hosts/${hostId}`, payload, { params: { test_mode: isTestMode } });
            toast({ title: "Host Updated", status: "success" });
        } else {
            await axios.post('/api/hosts', payload, { params: { test_mode: isTestMode } });
            toast({ title: "Host Created", status: "success" });
        }
        navigate('/status');
    } catch (err) {
        toast({ title: "Error", description: err.response?.data?.detail || err.message, status: "error" });
    } finally {
        setIsSaving(false);
    }
  };

  const filteredContextFiles = availableContextFiles.filter(file => 
      file.toLowerCase().includes(contextSearchTerm.toLowerCase())
  );
  
  // Check if there are selected files to enable trash can
  const hasSelectedFiles = formData.context_files.length > 0;

  if (loading) return <Center h="80vh"><Spinner size="xl" /></Center>;
  if (error) return <Alert status="error"><AlertIcon />{error}</Alert>;

  return (
    <Box>
      <VStack spacing={4} align="stretch" as="form" onSubmit={handleSubmit}>
        <Flex align="center" mb={4}>
          <IconButton icon={<ArrowBackIcon />} aria-label="Back to hosts" variant="ghost" onClick={() => navigate('/status')} mr={2} />
          <Heading size="lg">{isEditing ? `Edit Host: ${formData.syshostname}` : 'Add New Host'}</Heading>
        </Flex>

        <Grid templateColumns={{ base: '1fr', lg: '1fr 1fr' }} gap={6}>
            <GridItem><FormCard title="Basic Information">
                <FormControl isRequired>
                    <FormLabel fontSize="sm">Hostname</FormLabel>
                    <Input name="syshostname" value={formData.syshostname} onChange={handleInputChange} isDisabled={isEditing}/>
                </FormControl>
                <FormControl>
                    <FormLabel fontSize="sm">Log File Path</FormLabel>
                    <Input name="logfile" value={formData.logfile} onChange={handleInputChange}/>
                </FormControl>
                <FormControl>
                    <FormLabel fontSize="sm">Timezone</FormLabel>
                    <Input name="timezone" value={formData.timezone} onChange={handleInputChange}/>
                </FormControl>
            </FormCard></GridItem>
            
            <GridItem><FormCard title="Analysis Schedule">
                <FormControl>
                    <FormLabel fontSize="sm">Run Interval (seconds)</FormLabel>
                    <RadioGroup onChange={(val) => { setRunIntervalType(val); if(val === 'default') setFormData(p=>({...p, run_interval_seconds: 3600}))}} value={runIntervalType}>
                        <Stack direction="row"><Radio value="default">Default (3600s)</Radio><Radio value="custom">Custom</Radio></Stack>
                    </RadioGroup>
                    {runIntervalType === 'custom' && <Input mt={2} type="number" name="run_interval_seconds" value={formData.run_interval_seconds} onChange={handleInputChange} />}
                </FormControl>
                <FormControl>
                    <FormLabel fontSize="sm">Initial Scan (hours)</FormLabel>
                    <RadioGroup onChange={(val) => { setHoursType(val); if(val === 'default') setFormData(p=>({...p, hourstoanalyze: 24}))}} value={hoursType}>
                        <Stack direction="row"><Radio value="default">Default (24h)</Radio><Radio value="custom">Custom</Radio></Stack>
                    </RadioGroup>
                    {hoursType === 'custom' && <Input mt={2} type="number" name="hourstoanalyze" value={formData.hourstoanalyze} onChange={handleInputChange} />}
                </FormControl>
            </FormCard></GridItem>

            <GridItem colSpan={{ base: 1, lg: 2 }}><FormCard title="AI Analysis (Gemini)">
                <FormControl isRequired>
                    <FormLabel fontSize="sm">Gemini API Key</FormLabel>
                    <Input name="geminiapikey" type="password" value={formData.geminiapikey} onChange={handleInputChange}/>
                </FormControl>
                <FormControl>
                    <FormLabel fontSize="sm">Periodic Report Model</FormLabel>
                    <Select name="gemini_model" value={formData.gemini_model} onChange={handleInputChange}>
                        {Object.entries(geminiModels).map(([name, id]) => <option key={id} value={id}>{name}</option>)}
                    </Select>
                </FormControl>
            </FormCard></GridItem>

            <GridItem colSpan={{ base: 1, lg: 2 }}><FormCard title="Periodic Report & Email">
                 <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={6}>
                    <FormControl>
                        <FormLabel fontSize="sm">SMTP Profile (Optional)</FormLabel>
                        <Select name="smtp_profile" value={formData.smtp_profile} onChange={handleInputChange} placeholder="Use System Default">
                            {smtpProfiles.map(profile => <option key={profile} value={profile}>{profile}</option>)}
                        </Select>
                        <Text fontSize="xs" color="gray.500" mt={1}>Overrides the default system SMTP profile.</Text>
                    </FormControl>
                    <FormControl>
                        <FormLabel fontSize="sm">Recipient Emails</FormLabel>
                        <Button size="sm" onClick={() => openEmailModal('recipientemails')} width="full">Manage Emails</Button>
                        <Text fontSize="xs" color="gray.500" mt={1} isTruncated>Current: {formData.recipientemails || 'None'}</Text>
                    </FormControl>
                 </Grid>
            </FormCard></GridItem>
            
            <GridItem><FormCard title="Summary Report">
                <FormControl display="flex" alignItems="center">
                    <FormLabel htmlFor="summary-enabled" mb="0">Enable Summary</FormLabel>
                    <Switch id="summary-enabled" isChecked={formData.summary_enabled} onChange={(e) => setFormData(p=>({...p, summary_enabled: e.target.checked}))} />
                </FormControl>
                {formData.summary_enabled && <>
                    <FormControl><FormLabel fontSize="sm">Reports per Summary</FormLabel><Input type="number" name="reports_per_summary" value={formData.reports_per_summary} onChange={handleInputChange}/></FormControl>
                    <FormControl><FormLabel fontSize="sm">Summary Gemini Model</FormLabel>
                        <Select name="summary_gemini_model" value={formData.summary_gemini_model} onChange={handleInputChange}>
                            {Object.entries(geminiModels).map(([name, id]) => <option key={id} value={id}>{name}</option>)}
                        </Select>
                    </FormControl>
                    <Button size="sm" onClick={() => openEmailModal('summary_recipient_emails')}>Manage Summary Emails</Button>
                    <Text fontSize="xs" color="gray.500">Recipients: {formData.summary_recipient_emails || 'None'}</Text>
                </>}
            </FormCard></GridItem>

            <GridItem><FormCard title="Final Summary Report">
                <FormControl display="flex" alignItems="center">
                    <FormLabel htmlFor="final-enabled" mb="0">Enable Final Summary</FormLabel>
                    <Switch id="final-enabled" isChecked={formData.final_summary_enabled} onChange={(e) => setFormData(p=>({...p, final_summary_enabled: e.target.checked}))} />
                </FormControl>
                {formData.final_summary_enabled && <>
                    <FormControl><FormLabel fontSize="sm">Summaries per Final Report</FormLabel><Input type="number" name="summaries_per_final_report" value={formData.summaries_per_final_report} onChange={handleInputChange}/></FormControl>
                    <FormControl><FormLabel fontSize="sm">Final Summary Model</FormLabel>
                        <Select name="final_summary_model" value={formData.final_summary_model} onChange={handleInputChange}>
                            {Object.entries(geminiModels).map(([name, id]) => <option key={id} value={id}>{name}</option>)}
                        </Select>
                    </FormControl>
                    <Button size="sm" onClick={() => openEmailModal('final_summary_recipient_emails')}>Manage Final Summary Emails</Button>
                    <Text fontSize="xs" color="gray.500">Recipients: {formData.final_summary_recipient_emails || 'None'}</Text>
                </>}
            </FormCard></GridItem>

            <GridItem colSpan={{ base: 1, lg: 2 }}><FormCard title="Bonus Context">
                 <Grid templateColumns={{ base: '1fr', md: '1fr 2fr' }} gap={6}>
                    {/* Network Diagram Section */}
                    <FormControl>
                        <FormLabel fontSize="sm">Network Diagram</FormLabel>
                        <Box 
                            position="relative"
                            borderWidth="2px" 
                            borderStyle="dashed" 
                            borderColor="gray.300" 
                            borderRadius="md" 
                            p={4} 
                            textAlign="center" 
                            cursor="pointer"
                            _hover={{ borderColor: "blue.400", bg: hoverBg }}
                            onClick={() => !formData.networkdiagram && diagramInputRef.current.click()}
                        >
                             <input 
                                type="file" 
                                ref={diagramInputRef} 
                                style={{ display: 'none' }} 
                                accept="image/png, image/jpeg, image/svg+xml" 
                                onChange={handleNetworkDiagramUpload} 
                             />
                             {formData.networkdiagram ? (
                                <Box position="relative">
                                    <VStack spacing={2}>
                                        <AttachmentIcon boxSize={6} color="green.500" />
                                        <Text fontSize="sm" fontWeight="bold">{formData.networkdiagram.split('/').pop()}</Text>
                                    </VStack>
                                    <CloseButton 
                                        position="absolute" 
                                        top="-10px" 
                                        right="-10px" 
                                        size="sm" 
                                        rounded="full"
                                        bg={btnGrayBg}
                                        color={btnGrayColor}
                                        _hover={{ bg: "red.500", color: "white" }}
                                        onClick={(e) => { e.stopPropagation(); setFormData(p => ({...p, networkdiagram: ''})); }}
                                    />
                                </Box>
                             ) : (
                                <VStack spacing={2}>
                                    <AttachmentIcon boxSize={6} color="gray.400" />
                                    <Text fontSize="sm" color="gray.500">Click to upload diagram</Text>
                                </VStack>
                             )}
                        </Box>
                    </FormControl>

                    {/* Context Files Section */}
                    <FormControl>
                        <FormLabel fontSize="sm">Context Files</FormLabel>
                        <HStack mb={2}>
                            <InputGroup size="sm">
                                <InputLeftElement pointerEvents="none"><SearchIcon color="gray.300" /></InputLeftElement>
                                <Input 
                                    placeholder="Search files..." 
                                    value={contextSearchTerm} 
                                    onChange={(e) => setContextSearchTerm(e.target.value)} 
                                />
                            </InputGroup>
                             <input 
                                type="file" 
                                ref={contextInputRef} 
                                style={{ display: 'none' }} 
                                onChange={handleContextFileUpload} 
                             />
                            <Tooltip label="Upload New File" hasArrow>
                                <IconButton 
                                    icon={<AddIcon />} 
                                    size="sm" 
                                    bg={btnAddBg}
                                    color="gray.500"
                                    _hover={{ bg: btnAddHoverBg, color: btnAddHoverColor }}
                                    aria-label="Upload Context File" 
                                    onClick={() => contextInputRef.current.click()} 
                                />
                            </Tooltip>
                            <Tooltip label="Delete Selected Files from Server" hasArrow>
                                <IconButton 
                                    icon={<DeleteIcon />} 
                                    size="sm" 
                                    bg={hasSelectedFiles ? btnGrayBg : "transparent"}
                                    color={hasSelectedFiles ? btnGrayColor : "gray.300"}
                                    _hover={hasSelectedFiles ? { bg: btnDangerHoverBg, color: btnDangerHoverColor } : {}}
                                    isDisabled={!hasSelectedFiles}
                                    aria-label="Delete Selected Files"
                                    onClick={handleBulkDeleteClick}
                                />
                            </Tooltip>
                        </HStack>
                        
                        <VStack align="stretch" p={2} borderWidth={1} borderRadius="md" maxH="250px" overflowY="auto" spacing={0}>
                            {filteredContextFiles.length > 0 ? filteredContextFiles.map(file => (
                                <HStack key={file} p={2} _hover={{ bg: hoverBg }} borderRadius="sm">
                                    <Checkbox 
                                        isChecked={formData.context_files.includes(file)} 
                                        onChange={() => handleContextFileToggle(file)}
                                        flex="1"
                                    >
                                        <Text fontSize="sm" isTruncated maxW="350px" title={file}>{file.split('/').pop()}</Text>
                                    </Checkbox>
                                </HStack>
                            )) : (
                                <Text fontSize="sm" color="gray.500" textAlign="center" py={2}>No files found.</Text>
                            )}
                        </VStack>
                    </FormControl>
                 </Grid>
            </FormCard></GridItem>
        </Grid>
        
        <Box pt={4} pb={10}>
          <Button 
            type="submit" 
            isLoading={isSaving} 
            size="lg"
            bg={saveButtonBg} 
            color={saveButtonColor} 
            _hover={{ bg: saveButtonHoverBg }}
            boxShadow="md"
          >
            Save Host
          </Button>
        </Box>
      </VStack>

      {/* Email Modal */}
      <Modal isOpen={isEmailModalOpen} onClose={onEmailModalClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Manage Emails for {currentEmailField}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <HStack mb={4}>
                <Input placeholder="new.email@example.com" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} />
                <IconButton icon={<AddIcon />} aria-label="Add email" onClick={handleAddEmail} />
            </HStack>
            <Wrap>
                {(formData[currentEmailField] || '').split(',').filter(Boolean).map(email => (
                    <Tag key={email} size="md" borderRadius="full" variant="solid" colorScheme="blue">
                        <TagLabel>{email}</TagLabel>
                        <TagCloseButton onClick={() => handleRemoveEmail(email)} />
                    </Tag>
                ))}
            </Wrap>
          </ModalBody>
          <ModalFooter>
            <Button onClick={onEmailModalClose}>Done</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      
       <Modal isOpen={isDeleteFileModalOpen} onClose={onDeleteFileModalClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader color="red.500">Confirm Bulk Delete</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text mb={2}>You are about to delete <strong>{filesToDelete.length}</strong> file(s) from the server:</Text>
            <Box maxH="150px" overflowY="auto" bg="gray.100" p={2} borderRadius="md" mb={3} _dark={{bg: 'gray.700'}}>
                <ul style={{paddingLeft: '20px'}}>
                    {filesToDelete.map(f => <li key={f}><Text fontSize="sm">{f.split('/').pop()}</Text></li>)}
                </ul>
            </Box>
            <Alert status="warning" variant="left-accent">
                <AlertIcon />
                This action cannot be undone and will affect ALL hosts using these files.
            </Alert>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onDeleteFileModalClose}>Cancel</Button>
            <Button colorScheme="red" onClick={confirmDeleteFiles}>Delete Permanently</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

    </Box>
  );
};

export default HostFormPage;