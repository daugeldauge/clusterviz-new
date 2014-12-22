require 'open3'
require 'json'
require 'sinatra'
require 'sinatra/contrib'
require 'sinatra/base'
require 'timeout'
require 'neography'
require 'set'

def get_all_nodes
  nodes = []
  
  types = $neo.list_relationship_types
  $neo.execute_query("MATCH (n) RETURN n")['data'].each do |node|
    id = node[0]['metadata']['id']
    nodes[id] = node[0]['data']
    nodes[id]['out_relations_count'] = {}
  end
  
  types.each do |type|
    $neo.execute_query("MATCH (n)-[:#{type}]->(a) RETURN id(n), count(a)")['data'].each do |pair|
      nodes[pair[0]]['out_relations_count'][type] = pair[1]
    end
  end
  
  type_names = {}
  types.each do |type|
    nodes.each_with_index do |node, id|
      if node['out_relations_count'][type]
        query = "START n=node(#{id}) MATCH (n)-[r:#{type}]->(m) RETURN r.type"
        type_names[type] = $neo.execute_query(query)['data'][0][0]
        break
      end
    end
  end

  nodes.each do |node|
    sum = 0
    temp = {}
    node['out_relations_count'].each do |k, v|
      sum += v.to_i
      temp[type_names[k]] = v 
    end
    temp['all'] = sum
    node['out_relations_count'] = temp
  end

  $neo_types = {}
  type_names.each{ |k, v| $neo_types[v] = k }

  nodes
end

configure do
  set :port, 4568
  puts 'configure() starts'
  $neo = Neography::Rest.new('http://graphit.parallel.ru:7474')
  $nodes = get_all_nodes()
  puts 'configure() ends'
end

def error_page msg
  erb :error, :locals => {:msg => msg}
end

def get_roots(type)
  query = $neo.execute_query("MATCH (n) WHERE (n)-[:#{$neo_types[type]}]->() AND NOT ()-[:#{$neo_types[type]}]->(n) RETURN n")
  query['data'].map do |node|
    node[0]['metadata']['id']
  end
end

def get_id(url)
  url.gsub(/.*\D/, '').to_i
end

def get_levels(type, levels)
  roots = get_roots(type)
  rels = []
  type = $neo_types[type]
  rels[0] = roots.map{ |root| $neo.get_node_relationships(root, 'out', type) }.reduce(:+)
  (0...levels - 1).each do |i|
    rels[i + 1] = []
    rels[i].each do |rel|
      target = get_id rel['end']
      rels[i + 1] += $neo.get_node_relationships(target, 'out', type)
      #puts "#{i + 1} #{rels[i + 1].size}"
    end
    #puts "#{i} #{rels[i].size}"
  end
  rels
end

def get_links(rels)
  rels.map do |rel|
    {
      source: get_id(rel['start']),
      target: get_id(rel['end']),
      type: rel['data']['type']
    }
  end
end 

def get_graph(links, nodes = [])
  nodes = Set.new nodes
  links.each do |link|
    nodes.add(link[:source])
    nodes.add(link[:target])
  end

  nodes = nodes.to_a
  nodes.map! do |node|
    {id: node, size: 10, type: $nodes[node]['type']}
  end
  
  {nodes: nodes, links: links}
end

get '/node-info/:id' do
  content_type :json
  $nodes[params[:id].to_i].to_json
end

get '/node-out-relations/:id' do 
  type = params[:type]
  type = 'contain' unless type

  rels = $neo.get_node_relationships(params[:id], 'out', $neo_types[type])
  get_graph(get_links(rels)).to_json
end 

get '/neo' do
  levels_number = params[:levels].to_i
  if (levels_number == 0)
    roots = get_roots(params[:type])
    get_graph([], roots).to_json
  else  
    levels = get_levels(params[:type], levels_number)
    rels = levels.reduce(:+)
    links = get_links(rels)
    get_graph(links).to_json
  end
end

get '/about' do
  erb :about
end

get '/contact' do
  erb :contact
end

get '/' do
  erb :start
end

not_found do
  error_page '404'
end
